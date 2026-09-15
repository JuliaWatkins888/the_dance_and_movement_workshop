import { z } from 'zod';

// 24-hour "HH:mm" - matches a native <input type="time"> value directly, see class.contract.ts.
export const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected 24-hour HH:mm');

// Plain calendar date "YYYY-MM-DD" (no time-of-day component - startTime/endTime carry that
// separately) - kept as a validated string here and converted to a Date in the route handler,
// the same string-in/Date-at-the-boundary split time.schema.ts uses for its own date fields.
export const calendarDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

// Shared by classes.schema.ts and workshops.schema.ts, both of which carry an optional
// minAgeYears/maxAgeYears pair.
export const withAgeRangeCheck = (data: { minAgeYears?: number; maxAgeYears?: number }, ctx: z.RefinementCtx) => {
  if (data.minAgeYears !== undefined && data.maxAgeYears !== undefined && data.maxAgeYears < data.minAgeYears) {
    ctx.addIssue({ code: 'custom', path: ['maxAgeYears'], message: 'maxAgeYears must be greater than or equal to minAgeYears' });
  }
};
