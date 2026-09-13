import { createTimeAuditLog, findOpenTimeEntryByUserId, getTimeSettings, updateTimeEntry } from '@inithium/db';
import type { TimeEntryEntity } from '@inithium/db';
import { roundToNearestMinute } from './timeAccess';

// There is no cron/job runner anywhere in this codebase, so auto-clockout is a lazy sweep rather
// than a scheduled job: staleness is checked opportunistically whenever a possibly-open entry is
// read (a clock-in attempt, the self/admin entries or summary lists), not on a timer. Idempotent
// and safe to call speculatively on every such read path - an entry that isn't actually stale (or
// isn't open at all) passes through untouched.
export const sweepIfStale = async (entry: TimeEntryEntity): Promise<TimeEntryEntity> => {
  if (entry.endAt) return entry;

  const settings = await getTimeSettings();
  const thresholdMs = settings.autoClockoutThresholdMinutes * 60_000;
  const elapsedMs = Date.now() - entry.startAt.getTime();
  if (elapsedMs < thresholdMs) return entry;

  const closedAt = roundToNearestMinute(new Date(entry.startAt.getTime() + thresholdMs));
  const updated = await updateTimeEntry(entry.id, { endAt: closedAt, autoClosed: true });
  if (!updated) return entry;

  await createTimeAuditLog({
    entryId: entry.id,
    userId: entry.userId,
    actorId: entry.userId,
    action: 'auto_closed',
    after: { endAt: closedAt },
  });

  return updated;
};

// Convenience used by every route that needs to know "does this employee currently have an open
// entry" (clock-in's 409 check, switch-type, and every entries/summary list before it queries the
// range) - sweeps first so a stale entry never displays as still "open" to a caller.
export const findOpenEntrySwept = async (userId: string): Promise<TimeEntryEntity | null> => {
  const open = await findOpenTimeEntryByUserId(userId);
  if (!open) return null;
  return sweepIfStale(open);
};
