import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, ConflictError, createSuccessResponse, NotFoundError, UnauthorizedError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import {
  getBillingSubscriptionRepository,
  getClassRegistrationRepository,
  getClassSectionById,
  getCourseById,
  getProgramById,
  getSchoolYearById,
  getUserRepository,
  listEligibleAttendees,
  WITHDRAWAL_LOCKED_MESSAGE,
} from '@inithium/db';
import type { ClassRegistrationEntity } from '@inithium/db';
import { accrueLedgerTuition, cancelSubscriptionLine, withdrawClassRegistrationByStaff } from '@inithium/ecommerce';
import { assertRegistrationWithdrawable, isRegistrationWithdrawalLocked } from '../services/class-withdrawal.service';

const router: RouterType = Router();
const DESK_CAPABILITY = 'registrations:desk';

const nextMonthStart = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

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
  // Only a monthly plan that's still renewing can be cancelled; semester/year plans are paid in
  // full and non-withdrawable.
  const isRenewingMonthly = registration.plan === 'monthly' && isBilling;
  const isLocked = isRenewingMonthly && (await isRegistrationWithdrawalLocked(registration, section, schoolYear, now));
  // Pay-in-person monthly: tuition posts to the account ledger on the 1st.
  const isLedgerBilling = registration.billingMode === 'ledger' && registration.plan === 'monthly' && status === 'active';
  const ledgerNextMonth = isLedgerBilling ? nextMonthStart(now > registration.startsAt ? now : registration.startsAt) : undefined;

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
    billingMode: registration.billingMode,
    monthlyAmountCents: subscriptionLine?.unitAmountCents ?? registration.ledgerTerms?.monthlyAmountCents,
    nextBillingAt: isBilling
      ? subscription?.currentPeriodEnd
      : ledgerNextMonth && ledgerNextMonth < registration.endsAt
        ? ledgerNextMonth
        : undefined,
    isPastDue: isBilling && subscription?.status === 'past_due',
    canCancel: isRenewingMonthly && !isLocked,
    cancelLockedReason: isLocked ? WITHDRAWAL_LOCKED_MESSAGE : undefined,
    // Staff can stop any monthly plan still billing, however it's paid, regardless of the show lock.
    canStaffWithdraw: isRenewingMonthly || isLedgerBilling,
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
    const userId = currentUserId(req);
    await accrueLedgerTuition(userId, now);
    const registrations = await getClassRegistrationRepository().findByUserId(userId);
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
    await assertRegistrationWithdrawable(registration, new Date());

    await cancelSubscriptionLine(userId, registration.subscriptionId, registration.subscriptionLineId);
    const updated = (await repository.findById(registration.id)) ?? registration;
    res.status(200).json(createSuccessResponse(await toRegistrationDto(updated, new Date())));
  }),
);

// Every registration on a family's account, for staff at the desk.
router.get(
  '/api/users/:id/class-registrations',
  requireAuth,
  requirePermission(DESK_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = normalizeParam(req.params['id']);
    if (!(await getUserRepository().findById(userId))) throw NotFoundError('Account not found');
    const now = new Date();
    await accrueLedgerTuition(userId, now);
    const registrations = await getClassRegistrationRepository().findByUserId(userId);
    res.status(200).json(createSuccessResponse(await Promise.all(registrations.map((registration) => toRegistrationDto(registration, now)))));
  }),
);

// Staff stopping a monthly plan, whether it renews on a card or posts to the ledger. Unlike the
// family's own cancel, the show-semester lock doesn't apply.
router.post(
  '/api/class-registrations/:id/withdraw',
  requireAuth,
  requirePermission(DESK_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();
    const updated = await withdrawClassRegistrationByStaff(normalizeParam(req.params['id']), now);
    res.status(200).json(createSuccessResponse(await toRegistrationDto(updated, now)));
  }),
);

export default router;
