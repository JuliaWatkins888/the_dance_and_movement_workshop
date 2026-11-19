import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, NotFoundError, UnauthorizedError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import {
  addDaysToKey,
  countDaysBetweenKeys,
  dateKeyToUtc,
  getClassSectionById,
  getCourseById,
  getDropInRegistrationRepository,
  getProgramById,
  getTimeSettings,
  getUserRepository,
  listOpenDropInDates,
  releaseExpiredClassSeats,
  toDateKey,
  zonedDateKey,
} from '@inithium/db';
import type { DropInRegistrationEntity } from '@inithium/db';
import { cancelDropInByStaff, loadSectionContext } from '@inithium/ecommerce';
import { DEFAULT_DROP_IN_RANGE_DAYS, MAX_DROP_IN_RANGE_DAYS, dropInDatesQuerySchema } from '../schemas/drop-ins.schema';

const router: RouterType = Router();
const DESK_CAPABILITY = 'registrations:desk';

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const currentUserId = (req: Request): string => {
  if (!req.user) throw UnauthorizedError();
  return req.user.sub;
};

const toDropInDto = async (dropIn: DropInRegistrationEntity, todayKey: string) => {
  const [section, course] = await Promise.all([getClassSectionById(dropIn.sectionId), getCourseById(dropIn.courseId)]);
  const program = course ? await getProgramById(course.programId) : null;
  const classDate = toDateKey(dropIn.classDate);
  return {
    id: dropIn.id,
    attendee: dropIn.attendee,
    classDate,
    status: dropIn.status,
    isPast: classDate < todayKey,
    cancelledAt: dropIn.cancelledAt,
    orderId: dropIn.orderId,
    course: course ? { id: course.id, name: course.name, slug: course.slug } : undefined,
    programName: program?.name,
    section: section ? { id: section.id, daysOfWeek: section.daysOfWeek, startTime: section.startTime, endTime: section.endTime } : undefined,
    canStaffCancel: dropIn.status === 'active',
  };
};

const studioTodayKey = async (now: Date): Promise<string> => zonedDateKey(now, (await getTimeSettings()).timezone);

const listDropInDtos = async (userId: string) => {
  const todayKey = await studioTodayKey(new Date());
  const dropIns = await getDropInRegistrationRepository().findByUserId(userId);
  return Promise.all(dropIns.map((dropIn) => toDropInDto(dropIn, todayKey)));
};

// The upcoming dates a family can drop in on, with the seats each has left. Dates the studio is
// closed, or whose class has already started, aren't listed.
router.get(
  '/api/classes/sections/:id/drop-in-dates',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = dropInDatesQuerySchema.safeParse(req.query);
    if (!parsed.success) throw ValidationError('Invalid date range', parsed.error.flatten());

    const context = await loadSectionContext(normalizeParam(req.params['id']));
    const priceCents = context?.course.dropInPriceCents;
    if (!context || priceCents === undefined) throw NotFoundError('Drop-ins aren’t offered for this class');

    const now = new Date();
    const from = parsed.data.from ?? (await studioTodayKey(now));
    const to = parsed.data.to ?? addDaysToKey(from, DEFAULT_DROP_IN_RANGE_DAYS);
    if (countDaysBetweenKeys(from, to) > MAX_DROP_IN_RANGE_DAYS) throw ValidationError(`The range can span at most ${MAX_DROP_IN_RANGE_DAYS} days`);
    const lastKey = addDaysToKey(to, -1);

    await releaseExpiredClassSeats(now);
    const section = (await getClassSectionById(context.section.id)) ?? context.section;
    const [dates, held] = await Promise.all([
      listOpenDropInDates(section, context.semesters, from, lastKey, now),
      getDropInRegistrationRepository().countForSectionDates(section.id, dateKeyToUtc(from), dateKeyToUtc(lastKey)),
    ]);
    const termOpenings = section.capacity - section.enrolled;

    res.status(200).json(
      createSuccessResponse({
        sectionId: section.id,
        priceCents,
        startTime: section.startTime,
        endTime: section.endTime,
        dates: dates.map((date) => ({ date, seatsLeft: Math.max(0, termOpenings - (held.get(date) ?? 0)) })),
      }),
    );
  }),
);

router.get(
  '/api/drop-ins/mine',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await listDropInDtos(currentUserId(req))));
  }),
);

// Every drop-in on a family's account, for staff at the desk.
router.get(
  '/api/users/:id/drop-ins',
  requireAuth,
  requirePermission(DESK_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = normalizeParam(req.params['id']);
    if (!(await getUserRepository().findById(userId))) throw NotFoundError('Account not found');
    res.status(200).json(createSuccessResponse(await listDropInDtos(userId)));
  }),
);

// Staff only: frees the seat. Refunds or ledger voids are done separately.
router.post(
  '/api/drop-ins/:id/cancel',
  requireAuth,
  requirePermission(DESK_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();
    const cancelled = await cancelDropInByStaff(normalizeParam(req.params['id']), currentUserId(req), now);
    res.status(200).json(createSuccessResponse(await toDropInDto(cancelled, await studioTodayKey(now))));
  }),
);

export default router;
