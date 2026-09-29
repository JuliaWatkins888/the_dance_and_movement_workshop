import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, ConflictError, createSuccessResponse, NotFoundError, UnauthorizedError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import {
  getBillingSubscriptionRepository,
  getClassRegistrationRepository,
  getClassSectionById,
  getCourseById,
  getProgramById,
  getSchoolYearById,
  getUserRepository,
  listEligibleAttendees,
} from '@inithium/db';
import type { ClassRegistrationEntity } from '@inithium/db';
import { cancelSubscriptionLine } from '@inithium/ecommerce';

const router: RouterType = Router();

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const currentUserId = (req: Request): string => {
  if (!req.user) throw UnauthorizedError();
  return req.user.sub;
};

const loadUserName = async (userId: string): Promise<string> => {
  const user = await getUserRepository().findById(userId);
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ');
};

// What a family sees: an active registration whose paid term is over reads as ended, and a
// withdrawn monthly reads as ended once its last paid day has passed.
const displayStatus = (registration: ClassRegistrationEntity, now: Date): ClassRegistrationEntity['status'] => {
  if (registration.status === 'active' && registration.endsAt <= now) return 'ended';
  if (registration.status === 'withdrawn' && registration.accessEndsAt && registration.accessEndsAt <= now) return 'ended';
  return registration.status;
};

const toRegistrationDto = async (registration: ClassRegistrationEntity, now: Date) => {
  const [section, course, schoolYear, subscription] = await Promise.all([
    getClassSectionById(registration.sectionId),
    getCourseById(registration.courseId),
    getSchoolYearById(registration.schoolYearId),
    registration.subscriptionId ? getBillingSubscriptionRepository().findById(registration.subscriptionId) : Promise.resolve(null),
  ]);
  const program = course ? await getProgramById(course.programId) : null;
  const subscriptionLine = subscription?.lines.find((line) => line.id === registration.subscriptionLineId);
  const status = displayStatus(registration, now);
  const isBilling =
    status === 'active' &&
    subscription !== null &&
    (subscription.status === 'active' || subscription.status === 'past_due') &&
    subscriptionLine?.status === 'active';

  return {
    id: registration.id,
    attendee: registration.attendee,
    plan: registration.plan,
    semesterName: schoolYear?.semesters.find((semester) => semester.id === registration.semesterId)?.name,
    schoolYearName: schoolYear?.name,
    status,
    startsAt: registration.startsAt,
    endsAt: registration.endsAt,
    withdrawnAt: registration.withdrawnAt,
    accessEndsAt: registration.accessEndsAt,
    orderId: registration.orderId,
    course: course ? { id: course.id, name: course.name, slug: course.slug } : undefined,
    programName: program?.name,
    section: section
      ? { id: section.id, daysOfWeek: section.daysOfWeek, startTime: section.startTime, endTime: section.endTime }
      : undefined,
    monthlyAmountCents: subscriptionLine?.unitAmountCents,
    nextBillingAt: isBilling ? subscription?.currentPeriodEnd : undefined,
    isPastDue: isBilling && subscription?.status === 'past_due',
    // Only a monthly plan that's still renewing can be cancelled; semester/year plans are
    // paid in full and non-withdrawable.
    canCancel: registration.plan === 'monthly' && isBilling,
  };
};

// The account's attendees who may take this section's course today - only these are offered on
// the class page's dancer picker.
router.get(
  '/api/class-registrations/attendees',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const sectionId = typeof req.query['sectionId'] === 'string' ? req.query['sectionId'] : '';
    if (!sectionId) throw ValidationError('sectionId is required');
    const section = await getClassSectionById(sectionId);
    const course = section ? await getCourseById(section.courseId) : null;
    if (!section || !course) throw NotFoundError('Class not found');

    const userId = currentUserId(req);
    const attendees = await listEligibleAttendees(userId, await loadUserName(userId), course, new Date());
    res.status(200).json(createSuccessResponse(attendees));
  }),
);

router.get(
  '/api/class-registrations/mine',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();
    const registrations = await getClassRegistrationRepository().findByUserId(currentUserId(req));
    res.status(200).json(createSuccessResponse(await Promise.all(registrations.map((registration) => toRegistrationDto(registration, now)))));
  }),
);

// Stops the monthly subscription line behind a registration. No proration or refund: the dancer
// keeps attending through the period already paid for (see class.purchasable.ts's
// onSubscriptionLineEnded, which records the withdrawal).
router.post(
  '/api/class-registrations/mine/:id/cancel',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = currentUserId(req);
    const repository = getClassRegistrationRepository();
    const registration = await repository.findById(normalizeParam(req.params['id']));
    if (!registration || registration.userId !== userId) throw NotFoundError('Registration not found');
    if (registration.plan !== 'monthly') throw ConflictError('Semester and full-year plans are paid in full and can’t be cancelled');
    if (registration.status !== 'active' || !registration.subscriptionId || !registration.subscriptionLineId) {
      throw ConflictError('This registration has no monthly billing left to cancel');
    }

    await cancelSubscriptionLine(userId, registration.subscriptionId, registration.subscriptionLineId);
    const updated = (await repository.findById(registration.id)) ?? registration;
    res.status(200).json(createSuccessResponse(await toRegistrationDto(updated, new Date())));
  }),
);

export default router;
