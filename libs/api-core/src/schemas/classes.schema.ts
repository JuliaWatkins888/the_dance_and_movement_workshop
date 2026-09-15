import { z } from 'zod';
import { DAYS_OF_WEEK } from '@inithium/db';

// 24-hour "HH:mm" - matches a native <input type="time"> value directly, see class.contract.ts.
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeString = z.string().regex(TIME_REGEX, 'Expected 24-hour HH:mm');

// Plain calendar date "YYYY-MM-DD" (no time-of-day component - startTime/endTime carry that
// separately) - kept as a validated string here and converted to a Date in the route handler,
// the same string-in/Date-at-the-boundary split time.schema.ts uses for its own date fields.
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const calendarDateString = z.string().regex(DATE_REGEX, 'Expected YYYY-MM-DD');

const withAgeRangeCheck = (data: { minAgeYears?: number; maxAgeYears?: number }, ctx: z.RefinementCtx) => {
  if (data.minAgeYears !== undefined && data.maxAgeYears !== undefined && data.maxAgeYears < data.minAgeYears) {
    ctx.addIssue({ code: 'custom', path: ['maxAgeYears'], message: 'maxAgeYears must be greater than or equal to minAgeYears' });
  }
};

const classShape = {
  name: z.string().min(1, 'Name is required'),
  description: z.string().max(4000).optional(),
  categories: z.array(z.string().min(1)).min(1, 'At least one category is required'),
  instructors: z.array(z.string().min(1)).default([]),
  daysOfWeek: z.array(z.enum(DAYS_OF_WEEK)).min(1, 'At least one day is required'),
  startTime: timeString,
  endTime: timeString,
  session: z.string().min(1, 'Session is required'),
  registrationStartDate: calendarDateString.optional(),
  startDate: calendarDateString,
  endDate: calendarDateString,
  minAgeYears: z.number().min(0).max(120).optional(),
  maxAgeYears: z.number().min(0).max(120).optional(),
  priceAmount: z.number().min(0, 'Price must be zero or greater'),
  billingCycle: z.string().min(1).default('Monthly'),
  capacity: z.number().int().min(0, 'Capacity must be zero or greater'),
  enrolled: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
};

export const createClassSchema = z.object(classShape).superRefine(withAgeRangeCheck);
export type CreateClassRequestBody = z.infer<typeof createClassSchema>;

export const updateClassSchema = z.object(classShape).partial().superRefine(withAgeRangeCheck);
export type UpdateClassRequestBody = z.infer<typeof updateClassSchema>;
