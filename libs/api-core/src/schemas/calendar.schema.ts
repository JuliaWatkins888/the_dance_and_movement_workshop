import { z } from 'zod';
import { httpUrlSchema } from './url.schema';

// 24-hour "HH:mm" and "YYYY-MM-DD" - native <input type="time"> / <input type="date"> values.
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected 24-hour HH:mm');
export const calendarDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

// A year view spans 12 months plus the partial weeks around them.
export const MAX_CALENDAR_RANGE_DAYS = 400;

export const calendarRangeQuerySchema = z
  .object({
    from: calendarDateString,
    // Exclusive, matching how the calendar reports the end of a visible range.
    to: calendarDateString,
  })
  .refine((range) => range.from < range.to, { path: ['to'], message: '`to` must be after `from`' });

export const holidayYearQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2200),
});

export const holidayOpeningSchema = z.object({
  isStudioOpen: z.boolean(),
});

// Used for both create and update - the CMS always saves the whole entry, so an optional field
// missing from an update means it was cleared.
export const calendarEntryWriteSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120),
    description: z.string().trim().max(4000).optional(),
    startDate: calendarDateString,
    endDate: calendarDateString,
    startTime: timeString.optional(),
    endTime: timeString.optional(),
    isStudioClosed: z.boolean(),
    isAtStudio: z.boolean(),
    venueName: z.string().trim().min(1).max(120).optional(),
    venueAddress: z.string().trim().min(1).max(300).optional(),
    linkUrl: httpUrlSchema.optional(),
    isPublished: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.endDate < data.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'The end date must be on or after the start date' });
    }
    if (Boolean(data.startTime) !== Boolean(data.endTime)) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Give both a start and end time, or leave both blank for all day' });
    }
    if (data.startTime && data.endTime && data.startDate === data.endDate && data.endTime <= data.startTime) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'The end time must be after the start time' });
    }
    if (data.isStudioClosed && data.startTime) {
      ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'A studio closure is always all day' });
    }
    if (!data.isAtStudio && (!data.venueName || !data.venueAddress)) {
      ctx.addIssue({ code: 'custom', path: ['venueName'], message: 'An entry away from the studio needs a venue name and address' });
    }
  });

export type CalendarEntryWriteBody = z.infer<typeof calendarEntryWriteSchema>;
