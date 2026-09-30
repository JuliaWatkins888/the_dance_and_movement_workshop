import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import type { ZodType } from 'zod';
import { asyncHandler, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import {
  closeStudioOnHoliday,
  createCalendarEntry,
  deleteCalendarEntry,
  findFederalHoliday,
  getCalendarEntryById,
  listCalendarEntries,
  openStudioOnHoliday,
  updateCalendarEntry,
} from '@inithium/db';
import type { CreateCalendarEntryInput } from '@inithium/db';
import {
  MAX_CALENDAR_RANGE_DAYS,
  calendarDateString,
  calendarEntryWriteSchema,
  calendarRangeQuerySchema,
  holidayOpeningSchema,
  holidayYearQuerySchema,
} from '../schemas/calendar.schema';
import type { CalendarEntryWriteBody } from '../schemas/calendar.schema';
import { buildPublicCalendar, countDays, resolveHolidays } from '../services/calendar.service';

const router: RouterType = Router();

const MANAGE = requirePermission('calendar:manage');

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const parseWith = <T>(schema: ZodType<T>, value: unknown, message: string): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw ValidationError(message, parsed.error.flatten());
  return parsed.data;
};

const toUtcDate = (calendarDate: string): Date => new Date(`${calendarDate}T00:00:00.000Z`);

const isTimed = (body: CalendarEntryWriteBody): boolean => Boolean(body.startTime && body.endTime) && !body.isStudioClosed;

// Everything the CMS always sends, plus the optional fields that were given.
const toEntryInput = (body: CalendarEntryWriteBody, isPublished: boolean): CreateCalendarEntryInput => ({
  title: body.title,
  startDate: toUtcDate(body.startDate),
  endDate: toUtcDate(body.endDate),
  isStudioClosed: body.isStudioClosed,
  isAtStudio: body.isAtStudio,
  isPublished,
  ...(body.description ? { description: body.description } : {}),
  ...(isTimed(body) ? { startTime: body.startTime, endTime: body.endTime } : {}),
  ...(!body.isAtStudio && body.venueName ? { venueName: body.venueName } : {}),
  ...(!body.isAtStudio && body.venueAddress ? { venueAddress: body.venueAddress } : {}),
  ...(body.linkUrl ? { linkUrl: body.linkUrl } : {}),
});

// ---- Public ----------------------------------------------------------------------------------

router.get(
  '/api/calendar',
  asyncHandler(async (req: Request, res: Response) => {
    const range = parseWith(calendarRangeQuerySchema, req.query, 'Invalid calendar range');
    if (countDays(range.from, range.to) > MAX_CALENDAR_RANGE_DAYS) {
      throw ValidationError(`A calendar range can span at most ${MAX_CALENDAR_RANGE_DAYS} days`);
    }
    res.status(200).json(createSuccessResponse(await buildPublicCalendar(range)));
  }),
);

// ---- Admin: entries --------------------------------------------------------------------------

// Drafts included, soonest first.
router.get(
  '/api/calendar/admin/entries',
  requireAuth,
  MANAGE,
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await listCalendarEntries()));
  }),
);

router.post(
  '/api/calendar/entries',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseWith(calendarEntryWriteSchema, req.body, 'Invalid request body');
    res.status(201).json(createSuccessResponse(await createCalendarEntry(toEntryInput(body, body.isPublished ?? true))));
  }),
);

// Replaces the whole entry - an optional field left out of the body is cleared.
router.put(
  '/api/calendar/entries/:id',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params['id']);
    const existing = await getCalendarEntryById(id);
    if (!existing) throw NotFoundError('Calendar entry not found');
    const body = parseWith(calendarEntryWriteSchema, req.body, 'Invalid request body');
    const input = toEntryInput(body, body.isPublished ?? existing.isPublished);
    const entry = await updateCalendarEntry(id, {
      ...input,
      description: input.description ?? null,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      venueName: input.venueName ?? null,
      venueAddress: input.venueAddress ?? null,
      linkUrl: input.linkUrl ?? null,
    });
    if (!entry) throw NotFoundError('Calendar entry not found');
    res.status(200).json(createSuccessResponse(entry));
  }),
);

router.delete(
  '/api/calendar/entries/:id',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await deleteCalendarEntry(normalizeParam(req.params['id'])))) throw NotFoundError('Calendar entry not found');
    res.status(204).send();
  }),
);

// ---- Admin: holidays -------------------------------------------------------------------------

// A year's federal holidays with whether the studio is closed on each.
router.get(
  '/api/calendar/admin/holidays',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const { year } = parseWith(holidayYearQuerySchema, req.query, 'Invalid year');
    res.status(200).json(createSuccessResponse(await resolveHolidays(`${year}-01-01`, `${year}-12-31`)));
  }),
);

// Holidays default to closed; opening one only affects that single date.
router.put(
  '/api/calendar/admin/holidays/:date',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const dateKey = parseWith(calendarDateString, normalizeParam(req.params['date']), 'Invalid date');
    const holiday = findFederalHoliday(dateKey);
    if (!holiday) throw NotFoundError('That date is not a federal holiday');
    const { isStudioOpen } = parseWith(holidayOpeningSchema, req.body, 'Invalid request body');
    if (isStudioOpen) await openStudioOnHoliday(toUtcDate(dateKey), holiday.key);
    else await closeStudioOnHoliday(toUtcDate(dateKey));
    res.status(200).json(createSuccessResponse({ ...holiday, isStudioClosed: !isStudioOpen }));
  }),
);

export default router;
