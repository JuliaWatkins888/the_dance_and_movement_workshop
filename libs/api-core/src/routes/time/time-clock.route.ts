import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, ConflictError, createSuccessResponse, ForbiddenError, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import {
  createTimeAuditLog,
  createTimeEntry,
  deleteTimeEntry,
  findTimeEntryById,
  findTimeEntryTypeById,
  listTimeEntriesInRange,
  updateTimeEntry,
} from '@inithium/db';
import { clockInSchema, retagEntrySchema, switchTypeSchema } from '../../schemas/time.schema';
import { normalizeParam, roundToNearestMinute } from './timeAccess';
import { findOpenEntrySwept } from './timeSweep';
import { computeTotalsByType, toTimeEntryDto } from './timeDto';

const router: RouterType = Router();

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

// Employees only ever clock themselves in/out live - startAt/endAt are always `now`, never
// hand-set. A manual/backdated entry with a chosen start/end is exclusively a time:manage power
// (see time-admin.route.ts) - this whole file never accepts a client-supplied timestamp.
router.post(
  '/api/time/clock-in',
  requireAuth,
  requirePermission('time:track'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = clockInSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const userId = req.user!.sub;
    const alreadyOpen = await findOpenEntrySwept(userId);
    if (alreadyOpen && !alreadyOpen.endAt) {
      throw ConflictError('You are already clocked in');
    }

    const type = await findTimeEntryTypeById(parsed.data.typeId);
    if (!type) {
      throw NotFoundError('Time entry type not found');
    }

    const entry = await createTimeEntry({
      userId,
      typeId: parsed.data.typeId,
      startAt: roundToNearestMinute(new Date()),
      createdBy: userId,
    });
    await createTimeAuditLog({ entryId: entry.id, userId, actorId: userId, action: 'clock_in', after: { typeId: entry.typeId, startAt: entry.startAt } });

    res.status(201).json(createSuccessResponse(toTimeEntryDto(entry)));
  }),
);

router.post(
  '/api/time/clock-out',
  requireAuth,
  requirePermission('time:track'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    const open = await findOpenEntrySwept(userId);
    if (!open || open.endAt) {
      throw ConflictError('You are not currently clocked in');
    }

    const endAt = roundToNearestMinute(new Date());
    const updated = await updateTimeEntry(open.id, { endAt });
    if (!updated) {
      throw NotFoundError('Time entry not found');
    }
    await createTimeAuditLog({ entryId: updated.id, userId, actorId: userId, action: 'clock_out', after: { endAt } });

    res.status(200).json(createSuccessResponse(toTimeEntryDto(updated)));
  }),
);

// Closes the currently-open entry at `now` and opens a fresh one at the same instant with the
// new type - never leaves a gap or lets two entries overlap, since both writes use the identical
// timestamp. Not wrapped in a Mongo transaction: this codebase has no transaction usage anywhere,
// and user.repository.ts's own transferOwnership documents the same accepted precedent for a
// small, non-atomic window between sequential writes rather than introducing session machinery
// for one case.
router.post(
  '/api/time/switch-type',
  requireAuth,
  requirePermission('time:track'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = switchTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const userId = req.user!.sub;
    const open = await findOpenEntrySwept(userId);
    if (!open || open.endAt) {
      throw ConflictError('You are not currently clocked in');
    }

    const type = await findTimeEntryTypeById(parsed.data.typeId);
    if (!type) {
      throw NotFoundError('Time entry type not found');
    }

    const now = roundToNearestMinute(new Date());
    const closed = await updateTimeEntry(open.id, { endAt: now });
    if (closed) {
      await createTimeAuditLog({ entryId: closed.id, userId, actorId: userId, action: 'type_switch', after: { endAt: now } });
    }

    const created = await createTimeEntry({ userId, typeId: parsed.data.typeId, startAt: now, createdBy: userId });
    await createTimeAuditLog({ entryId: created.id, userId, actorId: userId, action: 'type_switch', after: { typeId: created.typeId, startAt: now } });

    res.status(201).json(createSuccessResponse(toTimeEntryDto(created)));
  }),
);

router.get(
  '/api/time/my/entries',
  requireAuth,
  requirePermission('time:track'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    await findOpenEntrySwept(userId);
    const { from, to } = parseRangeQuery(req);
    const entries = await listTimeEntriesInRange({ userId, from, to });
    res.status(200).json(createSuccessResponse(entries.map(toTimeEntryDto)));
  }),
);

router.get(
  '/api/time/my/summary',
  requireAuth,
  requirePermission('time:track'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    await findOpenEntrySwept(userId);
    const { from, to } = parseRangeQuery(req);
    const entries = await listTimeEntriesInRange({ userId, from, to });
    res.status(200).json(createSuccessResponse(computeTotalsByType(entries)));
  }),
);

router.patch(
  '/api/time/my/entries/:id',
  requireAuth,
  requirePermission('time:track'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const parsed = retagEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const userId = req.user!.sub;
    const entry = await findTimeEntryById(id);
    if (!entry) {
      throw NotFoundError('Time entry not found');
    }
    if (entry.userId !== userId) {
      throw ForbiddenError('You can only edit your own time entries');
    }
    if (entry.locked) {
      throw ConflictError('This entry is locked and cannot be edited');
    }

    const type = await findTimeEntryTypeById(parsed.data.typeId);
    if (!type) {
      throw NotFoundError('Time entry type not found');
    }

    const updated = await updateTimeEntry(id, { typeId: parsed.data.typeId });
    if (!updated) {
      throw NotFoundError('Time entry not found');
    }
    await createTimeAuditLog({
      entryId: id,
      userId,
      actorId: userId,
      action: 'updated',
      before: { typeId: entry.typeId },
      after: { typeId: updated.typeId },
    });

    res.status(200).json(createSuccessResponse(toTimeEntryDto(updated)));
  }),
);

router.delete(
  '/api/time/my/entries/:id',
  requireAuth,
  requirePermission('time:track'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const userId = req.user!.sub;
    const entry = await findTimeEntryById(id);
    if (!entry) {
      throw NotFoundError('Time entry not found');
    }
    if (entry.userId !== userId) {
      throw ForbiddenError('You can only delete your own time entries');
    }
    if (entry.locked) {
      throw ConflictError('This entry is locked and cannot be deleted');
    }

    await createTimeAuditLog({
      entryId: id,
      userId,
      actorId: userId,
      action: 'deleted',
      before: { typeId: entry.typeId, startAt: entry.startAt, endAt: entry.endAt },
    });
    await deleteTimeEntry(id);

    res.status(204).send();
  }),
);

export default router;
