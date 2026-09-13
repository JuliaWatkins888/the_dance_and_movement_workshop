import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, ConflictError, createSuccessResponse, ForbiddenError, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requireOwner, requirePermission } from '@inithium/permissions';
import {
  createTimeAuditLog,
  createTimeEntry,
  deleteTimeEntry,
  findOverlappingTimeEntries,
  findTimeEntryById,
  findTimeEntryTypeById,
  getTimeSettings,
  getUserRepository,
  listTimeAuditLogByEntryId,
  listTimeEntriesForUsersInRange,
  listTimeEntriesInRange,
  listUsers,
  updateTimeEntry,
} from '@inithium/db';
import type { UserEntity } from '@inithium/db';
import { createManualEntrySchema, updateManualEntrySchema } from '../../schemas/time.schema';
import { canActOnEmployee, isEmployee, normalizeParam } from './timeAccess';
import { findOpenEntrySwept } from './timeSweep';
import { zonedWallTimeToUtc } from './timeZoneMath';
import { computeTotalsByType, toTimeEntryDto } from './timeDto';

const router: RouterType = Router();

// A bounded, unfiltered fetch rather than adding a role/hierarchy filter to the core
// UserRepository contract for one caller - mirrors staff.route.ts's own /api/staff/user-candidates
// precedent exactly, including its rationale (the eligible roster is expected to stay small: this
// plugin's own scale target is ~25 employees).
const EMPLOYEE_FETCH_LIMIT = 200;

const toEmployeeDto = (user: UserEntity) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  isOwner: user.isOwner,
});

const parseRangeQuery = (req: Request): { from: Date; to: Date } => {
  const rawFrom = typeof req.query['from'] === 'string' ? req.query['from'] : undefined;
  const rawTo = typeof req.query['to'] === 'string' ? req.query['to'] : undefined;
  const from = rawFrom ? new Date(rawFrom) : new Date(0);
  const to = rawTo ? new Date(rawTo) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw ValidationError('Invalid from/to date');
  }
  return { from, to };
};

const loadActionableTarget = async (actor: UserEntity, userId: string): Promise<UserEntity> => {
  const target = await getUserRepository().findById(userId);
  if (!target) {
    throw NotFoundError('Employee not found');
  }
  if (!canActOnEmployee(actor, target)) {
    throw ForbiddenError("You don't have permission to manage this employee's time");
  }
  return target;
};

router.get(
  '/api/time/admin/employees',
  requireAuth,
  requirePermission('time:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.permissionUser!;
    const result = await listUsers({ page: 1, pageSize: EMPLOYEE_FETCH_LIMIT });
    const employees = result.items.filter((user) => isEmployee(user) && canActOnEmployee(actor, user));
    res.status(200).json(createSuccessResponse(employees.map(toEmployeeDto)));
  }),
);

router.get(
  '/api/time/admin/entries',
  requireAuth,
  requirePermission('time:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = typeof req.query['userId'] === 'string' ? req.query['userId'] : undefined;
    if (!userId) {
      throw ValidationError('userId is required');
    }
    await loadActionableTarget(req.permissionUser!, userId);
    await findOpenEntrySwept(userId);
    const { from, to } = parseRangeQuery(req);
    const entries = await listTimeEntriesInRange({ userId, from, to });
    res.status(200).json(createSuccessResponse(entries.map(toTimeEntryDto)));
  }),
);

router.get(
  '/api/time/admin/summary',
  requireAuth,
  requirePermission('time:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = typeof req.query['userId'] === 'string' ? req.query['userId'] : undefined;
    if (!userId) {
      throw ValidationError('userId is required');
    }
    await loadActionableTarget(req.permissionUser!, userId);
    await findOpenEntrySwept(userId);
    const { from, to } = parseRangeQuery(req);
    const entries = await listTimeEntriesInRange({ userId, from, to });
    res.status(200).json(createSuccessResponse(computeTotalsByType(entries)));
  }),
);

// Powers the "All Employees" review view - every entry across every employee the actor can see,
// in one call, rather than one request per employee. Reuses the same cross-employee repository
// method the CSV export already needed (findManyForUsersInRange), and sweeps each employee's
// possibly-open entry first for the same reason the single-employee list does.
router.get(
  '/api/time/admin/entries/all',
  requireAuth,
  requirePermission('time:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.permissionUser!;
    const { from, to } = parseRangeQuery(req);

    const result = await listUsers({ page: 1, pageSize: EMPLOYEE_FETCH_LIMIT });
    const visibleEmployees = result.items.filter((user) => isEmployee(user) && canActOnEmployee(actor, user));

    await Promise.all(visibleEmployees.map((employee) => findOpenEntrySwept(employee.id)));

    const entries = await listTimeEntriesForUsersInRange({ userIds: visibleEmployees.map((employee) => employee.id), from, to });
    res.status(200).json(createSuccessResponse(entries.map(toTimeEntryDto)));
  }),
);

router.post(
  '/api/time/admin/entries',
  requireAuth,
  requirePermission('time:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createManualEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const actor = req.permissionUser!;
    await loadActionableTarget(actor, parsed.data.userId);

    const type = await findTimeEntryTypeById(parsed.data.typeId);
    if (!type) {
      throw NotFoundError('Time entry type not found');
    }

    const settings = await getTimeSettings();
    const startAt = zonedWallTimeToUtc(parsed.data.startAt, settings.timezone);
    const endAt = parsed.data.endAt ? zonedWallTimeToUtc(parsed.data.endAt, settings.timezone) : undefined;

    const overlapping = await findOverlappingTimeEntries(parsed.data.userId, startAt, endAt);
    if (overlapping.length > 0) {
      throw ConflictError('This entry overlaps an existing time entry for this employee');
    }

    const entry = await createTimeEntry({
      userId: parsed.data.userId,
      typeId: parsed.data.typeId,
      startAt,
      endAt,
      createdBy: actor.id,
    });
    await createTimeAuditLog({
      entryId: entry.id,
      userId: entry.userId,
      actorId: actor.id,
      action: 'created',
      after: { typeId: entry.typeId, startAt: entry.startAt, endAt: entry.endAt },
    });

    res.status(201).json(createSuccessResponse(toTimeEntryDto(entry)));
  }),
);

router.patch(
  '/api/time/admin/entries/:id',
  requireAuth,
  requirePermission('time:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const parsed = updateManualEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const actor = req.permissionUser!;
    const entry = await findTimeEntryById(id);
    if (!entry) {
      throw NotFoundError('Time entry not found');
    }
    await loadActionableTarget(actor, entry.userId);
    if (entry.locked) {
      throw ConflictError('This entry is locked and cannot be edited. Unlock it first.');
    }

    if (parsed.data.typeId) {
      const type = await findTimeEntryTypeById(parsed.data.typeId);
      if (!type) {
        throw NotFoundError('Time entry type not found');
      }
    }

    const settings = await getTimeSettings();
    const nextStartAt = parsed.data.startAt ? zonedWallTimeToUtc(parsed.data.startAt, settings.timezone) : entry.startAt;
    const nextEndAt = parsed.data.endAt ? zonedWallTimeToUtc(parsed.data.endAt, settings.timezone) : entry.endAt;

    if (parsed.data.startAt || parsed.data.endAt) {
      const overlapping = await findOverlappingTimeEntries(entry.userId, nextStartAt, nextEndAt, id);
      if (overlapping.length > 0) {
        throw ConflictError('This entry overlaps an existing time entry for this employee');
      }
    }

    // Built up conditionally rather than as one object literal with possibly-undefined values -
    // an explicit `{ typeId: undefined }` key (vs. the key being absent entirely) can round-trip
    // through the Mongo driver's BSON encoding and actually clobber the existing field, unlike a
    // key that was never set on the object at all.
    const updateInput: { typeId?: string; startAt?: Date; endAt?: Date } = {};
    if (parsed.data.typeId) updateInput.typeId = parsed.data.typeId;
    if (parsed.data.startAt) updateInput.startAt = nextStartAt;
    if (parsed.data.endAt) updateInput.endAt = nextEndAt;

    const updated = await updateTimeEntry(id, updateInput);
    if (!updated) {
      throw NotFoundError('Time entry not found');
    }

    await createTimeAuditLog({
      entryId: id,
      userId: entry.userId,
      actorId: actor.id,
      action: 'updated',
      before: { typeId: entry.typeId, startAt: entry.startAt, endAt: entry.endAt },
      after: { typeId: updated.typeId, startAt: updated.startAt, endAt: updated.endAt },
    });

    res.status(200).json(createSuccessResponse(toTimeEntryDto(updated)));
  }),
);

router.delete(
  '/api/time/admin/entries/:id',
  requireAuth,
  requirePermission('time:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const actor = req.permissionUser!;
    const entry = await findTimeEntryById(id);
    if (!entry) {
      throw NotFoundError('Time entry not found');
    }
    await loadActionableTarget(actor, entry.userId);
    if (entry.locked) {
      throw ConflictError('This entry is locked and cannot be deleted. Unlock it first.');
    }

    await createTimeAuditLog({
      entryId: id,
      userId: entry.userId,
      actorId: actor.id,
      action: 'deleted',
      before: { typeId: entry.typeId, startAt: entry.startAt, endAt: entry.endAt },
    });
    await deleteTimeEntry(id);

    res.status(204).send();
  }),
);

// Owner-only, per spec - the owner always has final say and can override any lock, but locking
// itself is never delegated to a regular admin, even one who otherwise manages this employee's
// time. requireOwner already re-fetches req.permissionUser, so no separate canActOnEmployee check
// is needed here: the owner bypasses that hierarchy entirely.
router.post(
  '/api/time/admin/entries/:id/lock',
  requireAuth,
  requireOwner,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const entry = await findTimeEntryById(id);
    if (!entry) {
      throw NotFoundError('Time entry not found');
    }
    if (entry.locked) {
      res.status(200).json(createSuccessResponse(toTimeEntryDto(entry)));
      return;
    }

    const updated = await updateTimeEntry(id, { locked: true });
    if (!updated) {
      throw NotFoundError('Time entry not found');
    }
    await createTimeAuditLog({ entryId: id, userId: entry.userId, actorId: req.permissionUser!.id, action: 'locked' });

    res.status(200).json(createSuccessResponse(toTimeEntryDto(updated)));
  }),
);

router.post(
  '/api/time/admin/entries/:id/unlock',
  requireAuth,
  requireOwner,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const entry = await findTimeEntryById(id);
    if (!entry) {
      throw NotFoundError('Time entry not found');
    }
    if (!entry.locked) {
      res.status(200).json(createSuccessResponse(toTimeEntryDto(entry)));
      return;
    }

    const updated = await updateTimeEntry(id, { locked: false });
    if (!updated) {
      throw NotFoundError('Time entry not found');
    }
    await createTimeAuditLog({ entryId: id, userId: entry.userId, actorId: req.permissionUser!.id, action: 'unlocked' });

    res.status(200).json(createSuccessResponse(toTimeEntryDto(updated)));
  }),
);

router.get(
  '/api/time/admin/entries/:id/audit',
  requireAuth,
  requirePermission('time:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const entry = await findTimeEntryById(id);
    if (!entry) {
      throw NotFoundError('Time entry not found');
    }
    await loadActionableTarget(req.permissionUser!, entry.userId);

    const logs = await listTimeAuditLogByEntryId(id);
    res.status(200).json(
      createSuccessResponse(
        logs.map((log) => ({
          id: log.id,
          action: log.action,
          actorId: log.actorId,
          before: log.before
            ? { ...log.before, startAt: log.before.startAt?.toISOString(), endAt: log.before.endAt?.toISOString() }
            : undefined,
          after: log.after
            ? { ...log.after, startAt: log.after.startAt?.toISOString(), endAt: log.after.endAt?.toISOString() }
            : undefined,
          createdAt: log.createdAt.toISOString(),
        })),
      ),
    );
  }),
);

export default router;
