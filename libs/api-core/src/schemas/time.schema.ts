import { z } from 'zod';

export const clockInSchema = z.object({ typeId: z.string().min(1, 'A time entry type is required') });
export const switchTypeSchema = clockInSchema;
export const retagEntrySchema = z.object({ typeId: z.string().min(1, 'A time entry type is required') });

// A native <input type="datetime-local"> value ("2026-03-05T09:00" or "...:00" with seconds) -
// deliberately not z.iso.datetime(), which requires a 'Z'/offset suffix this value never has.
// This string is interpreted as wall-clock time *in the configured business timezone* (see
// timeZoneMath.ts's zonedWallTimeToUtc), not the admin's own browser timezone - an admin
// backfilling "worked 9-5" means 9-5 at the business, regardless of where they personally are.
const LOCAL_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const localDateTimeString = z.string().regex(LOCAL_DATETIME_REGEX, 'Expected YYYY-MM-DDTHH:mm');

// Zero-padded fixed-width strings compare correctly with a plain string comparison - avoids
// `new Date(...)` on a string with no zone suffix, whose interpretation (UTC vs. local) is
// spec-inconsistent across engines for exactly this shape.
const withOrderCheck = (data: { startAt?: string; endAt?: string }, ctx: z.RefinementCtx) => {
  if (data.startAt && data.endAt && data.endAt <= data.startAt) {
    ctx.addIssue({ code: 'custom', path: ['endAt'], message: 'endAt must be after startAt' });
  }
};

export const createManualEntrySchema = z
  .object({
    userId: z.string().min(1, 'An employee is required'),
    typeId: z.string().min(1, 'A time entry type is required'),
    startAt: localDateTimeString,
    endAt: localDateTimeString.optional(),
  })
  .superRefine(withOrderCheck);

export const updateManualEntrySchema = z
  .object({
    typeId: z.string().min(1).optional(),
    startAt: localDateTimeString.optional(),
    endAt: localDateTimeString.optional(),
  })
  .superRefine(withOrderCheck);

export const createEntryTypeSchema = z.object({
  label: z.string().min(1, 'A label is required').max(60),
  order: z.number().int().optional(),
});
export const updateEntryTypeSchema = createEntryTypeSchema.partial();

export const updateTimeSettingsSchema = z.object({
  timezone: z.string().min(1).optional(),
  autoClockoutThresholdMinutes: z.number().int().min(1).max(1440).optional(),
});

export const archiveYearSchema = z.object({ year: z.number().int().min(2000).max(2100) });
