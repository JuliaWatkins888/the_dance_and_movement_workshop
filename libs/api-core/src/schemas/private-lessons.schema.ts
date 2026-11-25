import { z } from 'zod';
import { DAYS_OF_WEEK } from '@inithium/db';
import { calendarDateString } from './calendar.schema';

const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, 'Expected an id');
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected 24-hour HH:mm');

export const MAX_PRIVATE_LESSON_SCHEDULE_DAYS = 62;

const attendeeRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('self') }),
  z.object({ type: z.literal('child'), childId: objectIdString }),
]);

const scheduleSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('weekly'),
      weekday: z.enum(DAYS_OF_WEEK),
      startTime: timeString,
      endTime: timeString,
      startDate: calendarDateString,
      endDate: calendarDateString.optional(),
    }),
    z.object({ kind: z.literal('once'), date: calendarDateString, startTime: timeString, endTime: timeString }),
  ])
  .refine((schedule) => schedule.endTime > schedule.startTime, { message: 'End time must be after start time', path: ['endTime'] })
  .refine((schedule) => schedule.kind !== 'weekly' || !schedule.endDate || schedule.endDate >= schedule.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });

const lessonFields = {
  attendee: attendeeRefSchema,
  instructorStaffId: objectIdString,
  title: z.string().trim().min(1).max(80),
  schedule: scheduleSchema,
  rateCents: z.number().int().min(0).max(10_000_00),
  notes: z.string().trim().max(1000).optional(),
};

export const createPrivateLessonSchema = z.object({ userId: objectIdString, ...lessonFields });
export type CreatePrivateLessonBody = z.infer<typeof createPrivateLessonSchema>;

// Replaces the whole lesson. The account it bills can't change; set up a new lesson instead.
export const updatePrivateLessonSchema = z.object(lessonFields);
export type UpdatePrivateLessonBody = z.infer<typeof updatePrivateLessonSchema>;
export type PrivateLessonScheduleBody = z.infer<typeof scheduleSchema>;

export const endPrivateLessonSchema = z.object({ lastDate: calendarDateString.optional() });

export const privateLessonExceptionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cancelled'), date: calendarDateString }),
  z
    .object({ kind: z.literal('moved'), date: calendarDateString, newDate: calendarDateString, newStartTime: timeString, newEndTime: timeString })
    .refine((body) => body.newEndTime > body.newStartTime, { message: 'End time must be after start time', path: ['newEndTime'] }),
]);
export type PrivateLessonExceptionBody = z.infer<typeof privateLessonExceptionSchema>;

export const privateLessonScheduleQuerySchema = z
  .object({ from: calendarDateString, to: calendarDateString, instructorStaffId: objectIdString.optional() })
  .refine((query) => query.to > query.from, { message: '`to` must be after `from`', path: ['to'] });
