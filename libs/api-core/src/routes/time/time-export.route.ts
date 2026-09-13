import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, ForbiddenError, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { getUserRepository, listTimeEntriesForUsersInRange, listTimeEntryTypes, listUsers } from '@inithium/db';
import type { UserEntity } from '@inithium/db';
import { canActOnEmployee, isEmployee } from './timeAccess';

const router: RouterType = Router();
const EMPLOYEE_FETCH_LIMIT = 200;

const escapeCsvField = (value: string): string => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const toCsvRow = (fields: string[]): string => fields.map(escapeCsvField).join(',');

// Hand-rolled rather than a CSV library - the format is simple enough (escape commas/quotes/
// newlines, join with CRLF) not to justify a new dependency for it. Plain fetch-and-download on
// the frontend, not RTK Query - a file attachment response doesn't fit RTK Query's cache model.
router.get(
  '/api/time/admin/export.csv',
  requireAuth,
  requirePermission('time:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const actor = req.permissionUser!;
    const rawFrom = typeof req.query['from'] === 'string' ? req.query['from'] : undefined;
    const rawTo = typeof req.query['to'] === 'string' ? req.query['to'] : undefined;
    const from = rawFrom ? new Date(rawFrom) : new Date(0);
    const to = rawTo ? new Date(rawTo) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw ValidationError('Invalid from/to date');
    }

    const requestedUserId = typeof req.query['userId'] === 'string' ? req.query['userId'] : undefined;
    let targets: UserEntity[];
    if (requestedUserId) {
      const target = await getUserRepository().findById(requestedUserId);
      if (!target) {
        throw NotFoundError('Employee not found');
      }
      if (!canActOnEmployee(actor, target)) {
        throw ForbiddenError("You don't have permission to export this employee's time");
      }
      targets = [target];
    } else {
      // No userId means "every employee the caller can see" - never an unscoped export, since
      // `targets` is still filtered through canActOnEmployee exactly like the employees-list and
      // entries endpoints.
      const result = await listUsers({ page: 1, pageSize: EMPLOYEE_FETCH_LIMIT });
      targets = result.items.filter((user) => isEmployee(user) && canActOnEmployee(actor, user));
    }

    const [entries, types] = await Promise.all([
      listTimeEntriesForUsersInRange({ userIds: targets.map((target) => target.id), from, to }),
      listTimeEntryTypes(),
    ]);

    const userById = new Map(targets.map((target) => [target.id, target]));
    const typeById = new Map(types.map((type) => [type.id, type]));

    const header = toCsvRow(['Employee', 'Email', 'Type', 'Start', 'End', 'Minutes', 'Locked', 'Auto-Closed']);
    const rows = entries.map((entry) => {
      const user = userById.get(entry.userId);
      const type = typeById.get(entry.typeId);
      const minutes = Math.max(0, Math.round(((entry.endAt ?? new Date()).getTime() - entry.startAt.getTime()) / 60_000));
      return toCsvRow([
        user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : entry.userId,
        user?.email ?? '',
        type?.label ?? entry.typeId,
        entry.startAt.toISOString(),
        entry.endAt ? entry.endAt.toISOString() : '',
        String(minutes),
        entry.locked ? 'yes' : 'no',
        entry.autoClosed ? 'yes' : 'no',
      ]);
    });

    const csv = [header, ...rows].join('\r\n');
    res
      .status(200)
      .set('Content-Type', 'text/csv; charset=utf-8')
      .set('Content-Disposition', 'attachment; filename="time-export.csv"')
      .send(csv);
  }),
);

export default router;
