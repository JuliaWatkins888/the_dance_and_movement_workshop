import { z } from 'zod';
import { calendarDateString } from './calendar.schema';

// Six weeks of classes by default; the class page lists these.
export const DEFAULT_DROP_IN_RANGE_DAYS = 42;
export const MAX_DROP_IN_RANGE_DAYS = 120;

// `to` is exclusive, like the calendar's range.
export const dropInDatesQuerySchema = z
  .object({
    from: calendarDateString.optional(),
    to: calendarDateString.optional(),
  })
  .refine((range) => !range.from || !range.to || range.from < range.to, { path: ['to'], message: '`to` must be after `from`' });
