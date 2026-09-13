import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requireOwner, requirePermission } from '@inithium/permissions';
import { deleteTimeAuditLogsByEntryIds, deleteTimeEntriesInRange, getTimeSettings, updateTimeSettings } from '@inithium/db';
import type { TimeSettingsEntity } from '@inithium/db';
import { archiveYearSchema, updateTimeSettingsSchema } from '../../schemas/time.schema';
import { getSupportedTimeZones, requireAnyCapability } from './timeAccess';
import { zonedYearBoundsToUtc } from './timeZoneMath';

const router: RouterType = Router();

const toSettingsDto = (settings: TimeSettingsEntity) => ({
  timezone: settings.timezone,
  autoClockoutThresholdMinutes: settings.autoClockoutThresholdMinutes,
  updatedAt: settings.updatedAt.toISOString(),
});

// Every employee needs the configured business timezone client-side for display (see the review
// calendar and personal history views) - not just a time:manage actor. Self-seeding on first read
// (see @inithium/db's getTimeSettings), same as entry types.
router.get(
  '/api/time/settings',
  requireAuth,
  requireAnyCapability('time:track', 'time:manage'),
  asyncHandler(async (_req: Request, res: Response) => {
    const settings = await getTimeSettings();
    res.status(200).json(createSuccessResponse(toSettingsDto(settings)));
  }),
);

router.patch(
  '/api/time/settings',
  requireAuth,
  requirePermission('time:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateTimeSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }
    if (parsed.data.timezone && !getSupportedTimeZones().includes(parsed.data.timezone)) {
      throw ValidationError('Unrecognized timezone');
    }

    const settings = await updateTimeSettings(parsed.data);
    res.status(200).json(createSuccessResponse(toSettingsDto(settings)));
  }),
);

// Destructive and hard to reverse, so this is a deliberate owner-triggered action, never a silent
// scheduled deletion - there is no cron/job runner in this codebase anyway (see timeSweep.ts's own
// lazy-sweep rationale), and even if there were, purging a year of payroll-adjacent history
// without a human confirming it first is exactly the kind of action CLAUDE.md's "actions with
// care" guidance warns against. The frontend's ArchiveExportSection pairs this tightly with a CSV
// export and an explicit confirm step.
router.post(
  '/api/time/admin/archive-year',
  requireAuth,
  requireOwner,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = archiveYearSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const settings = await getTimeSettings();
    const { from, to } = zonedYearBoundsToUtc(parsed.data.year, settings.timezone);
    const { deletedCount, deletedIds } = await deleteTimeEntriesInRange(from, to);
    await deleteTimeAuditLogsByEntryIds(deletedIds);

    res.status(200).json(createSuccessResponse({ deletedCount }));
  }),
);

export default router;
