import {
  findOverlappingRegistration,
  getBillingSubscriptionRepository,
  getCartRepository,
  getClassRegistrationRepository,
  getClassSectionRepository,
  getCourseRepository,
  getProgramRepository,
  getSchoolYearRepository,
  getUserRepository,
  releaseExpiredClassSeats,
  resolveClassPlanOptions,
  resolveEligibleAttendee,
  resolveMonthlySchedule,
  resolvePlanCoverage,
  resolveSectionSemesters,
  coveragesOverlap,
  describeAttendee,
} from '@inithium/db';
import type {
  AttendeeRef,
  BillingSubscriptionEntity,
  BillingSubscriptionLine,
  ClassPlanKind,
  ClassPlanOption,
  ClassSectionEntity,
  CourseEntity,
  LineOptions,
  OrderEntity,
  OrderLine,
  ProgramEntity,
  SchoolYearEntity,
  SemesterEntity,
} from '@inithium/db';
import type { PurchasableContext, PurchasableLineRef, PurchasableSource, ResolvedPurchasable } from './purchasable.contract';

export const CLASS_SOURCE_TYPE = 'class';

const CLASS_PLANS: ClassPlanKind[] = ['monthly', 'semester', 'year'];

// A class cart line: sourceId is the section id; options say who attends and how they pay -
// { attendee: 'self' } or { attendee: 'child', childId }, plus { plan, semesterId? }.
interface ClassLine {
  sectionId: string;
  attendee: AttendeeRef;
  plan: ClassPlanKind;
  semesterId?: string;
}

const parseClassLine = (sectionId: string, options: LineOptions): ClassLine | null => {
  const plan = options['plan'] as ClassPlanKind | undefined;
  if (!plan || !CLASS_PLANS.includes(plan)) return null;
  const semesterId = options['semesterId'];
  if (plan === 'semester' && !semesterId) return null;
  const attendee: AttendeeRef | null =
    options['attendee'] === 'self'
      ? { type: 'self' }
      : options['attendee'] === 'child' && options['childId']
        ? { type: 'child', childId: options['childId'] }
        : null;
  if (!attendee) return null;
  return { sectionId, attendee, plan, ...(plan === 'semester' && semesterId ? { semesterId } : {}) };
};

const sameAttendee = (a: AttendeeRef, b: AttendeeRef): boolean =>
  a.type === 'self' ? b.type === 'self' : b.type === 'child' && a.childId === b.childId;

interface SectionContext {
  section: ClassSectionEntity;
  course: CourseEntity;
  program: ProgramEntity;
  schoolYear: SchoolYearEntity;
  semesters: SemesterEntity[];
}

// Everything published that a line depends on, or null when any of it is gone or hidden.
const loadSectionContext = async (sectionId: string): Promise<SectionContext | null> => {
  const section = await getClassSectionRepository().findById(sectionId);
  if (!section?.isPublished) return null;
  const [course, schoolYear] = await Promise.all([
    getCourseRepository().findById(section.courseId),
    getSchoolYearRepository().findById(section.schoolYearId),
  ]);
  if (!course?.isPublished || !schoolYear?.isPublished) return null;
  const program = await getProgramRepository().findById(course.programId);
  if (!program?.isPublished) return null;
  return { section, course, program, schoolYear, semesters: resolveSectionSemesters(section.semesterIds, schoolYear.semesters) };
};

// The plan exactly as still offered today - null once its period has ended (registration closed).
const findPlanOption = (ctx: SectionContext, line: ClassLine, now: Date): ClassPlanOption | undefined =>
  resolveClassPlanOptions({
    monthlyPriceCents: ctx.course.monthlyPriceCents,
    sectionSemesterIds: ctx.section.semesterIds,
    schoolYearSemesters: ctx.schoolYear.semesters,
    now,
  }).find((option) => option.kind === line.plan && (line.plan !== 'semester' || option.semesterId === line.semesterId));

const coverageOf = (ctx: SectionContext, line: ClassLine, now: Date) =>
  resolvePlanCoverage(line.plan, line.semesterId, ctx.section.daysOfWeek, ctx.semesters, now);

const formatTime = (time: string): string => {
  const [hoursRaw, minutes] = time.split(':');
  const hours = Number(hoursRaw);
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
};

const sectionLabel = (section: ClassSectionEntity): string =>
  `${section.daysOfWeek.map((day) => day.slice(0, 3)).join(' & ')} ${formatTime(section.startTime)}`;

const planLabel = (option: ClassPlanOption): string => {
  if (option.kind === 'monthly') return 'Monthly';
  if (option.kind === 'semester') return `${option.semesterName ?? 'Semester'} (paid in full)`;
  return 'Full year (paid in full)';
};

const loadUserName = async (userId: string): Promise<string> => {
  const user = await getUserRepository().findById(userId);
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ');
};

const classPurchasable: PurchasableSource = {
  sourceType: CLASS_SOURCE_TYPE,

  resolve: async (ref: PurchasableLineRef, ctx: PurchasableContext): Promise<ResolvedPurchasable | null> => {
    const line = parseClassLine(ref.sourceId, ref.options);
    const section = line ? await loadSectionContext(line.sectionId) : null;
    if (!line || !section) return null;
    const option = findPlanOption(section, line, ctx.now);
    if (!option) return null;

    const name = (await describeAttendee(ctx.userId, await loadUserName(ctx.userId), line.attendee))?.name;
    const base = {
      name: `${section.course.name} · ${sectionLabel(section.section)}`,
      description: [planLabel(option), name ? `for ${name}` : undefined].filter(Boolean).join(' · '),
      ...(section.program.imageUrl ? { imageUrl: section.program.imageUrl } : {}),
      href: `/classes/${section.course.slug}?section=${section.section.id}`,
      unitAmountCents: option.amountCents,
      categories: [section.program.name],
      requiresShipping: false,
      maxQuantity: 1,
    };

    if (option.kind !== 'monthly') return { ...base, billing: { type: 'one_time' } };

    const schedule = resolveMonthlySchedule(section.section.daysOfWeek, section.semesters, ctx.now);
    if (!schedule) return null;
    return {
      ...base,
      billing: {
        type: 'recurring',
        interval: 'month',
        intervalCount: 1,
        nextBillingAt: schedule.nextBillingAt,
        endsAt: schedule.endsAt,
      },
    };
  },

  validate: async (ref, _resolved, ctx) => {
    const line = parseClassLine(ref.sourceId, ref.options);
    const section = line ? await loadSectionContext(line.sectionId) : null;
    if (!line || !section) return { ok: false, reason: 'This class is no longer available.' };
    if (ref.quantity !== 1) return { ok: false, reason: 'Each dancer can only be registered once per class.' };

    const opensAt = section.schoolYear.registrationOpensAt;
    if (opensAt && opensAt > ctx.now) return { ok: false, reason: 'Registration for this class hasn’t opened yet.' };

    const attendee = await resolveEligibleAttendee(ctx.userId, await loadUserName(ctx.userId), line.attendee, section.course, ctx.now);
    if (!attendee.ok) return { ok: false, reason: attendee.reason };

    await releaseExpiredClassSeats(ctx.now);
    const fresh = await getClassSectionRepository().findById(section.section.id);
    if (!fresh || fresh.enrolled >= fresh.capacity) return { ok: false, reason: 'This class is full.' };

    const coverage = coverageOf(section, line, ctx.now);
    if (!coverage) return { ok: false, reason: 'This class is no longer available.' };
    if (await findOverlappingRegistration(ctx.userId, section.section.id, line.attendee, coverage)) {
      return { ok: false, reason: `${attendee.attendee.name} is already registered for this class.` };
    }

    // Another line in the cart for the same dancer and section covering the same classes (e.g.
    // monthly and a semester plan) - an identical line merges instead, so it never lands here.
    const cart = await getCartRepository().findByUserId(ctx.userId);
    const conflicting = (cart?.lines ?? []).some((cartLine) => {
      if (cartLine.sourceType !== CLASS_SOURCE_TYPE || cartLine.sourceId !== ref.sourceId) return false;
      const other = parseClassLine(cartLine.sourceId, cartLine.options);
      if (!other || !sameAttendee(other.attendee, line.attendee)) return false;
      if (other.plan === line.plan && other.semesterId === line.semesterId) return false;
      const otherCoverage = coverageOf(section, other, ctx.now);
      return otherCoverage !== null && coveragesOverlap(otherCoverage, coverage);
    });
    if (conflicting) return { ok: false, reason: `${attendee.attendee.name} already has this class in the cart.` };

    return { ok: true };
  },

  reserve: async (ref, ctx) => {
    await releaseExpiredClassSeats(ctx.now);
    return getClassSectionRepository().reserveSeats(ref.sourceId, ref.quantity);
  },

  release: async (ref) => {
    await getClassSectionRepository().releaseSeats(ref.sourceId, ref.quantity);
  },

  // The seat was reserved before payment; this records the enrollment. Safe to run twice - the
  // registration is keyed by its order line.
  onPaid: async (orderLine: OrderLine, order: OrderEntity) => {
    const registrations = getClassRegistrationRepository();
    if (await registrations.findByOrderLineId(orderLine.id)) return;

    const line = parseClassLine(orderLine.sourceId, orderLine.options);
    if (!line) throw new Error('Class line has unreadable options');
    const section = await getClassSectionRepository().findById(line.sectionId);
    const [course, schoolYear] = section
      ? await Promise.all([getCourseRepository().findById(section.courseId), getSchoolYearRepository().findById(section.schoolYearId)])
      : [null, null];
    if (!section || !course || !schoolYear) throw new Error('The class was deleted before its registration could be recorded');

    const paidAt = order.paidAt ?? new Date();
    // Eligibility was checked at checkout; this only snapshots who attends.
    const attendee = await describeAttendee(order.userId, await loadUserName(order.userId), line.attendee);
    if (!attendee) throw new Error('The dancer on this registration is no longer on the account');

    const semesters = resolveSectionSemesters(section.semesterIds, schoolYear.semesters);
    const coverage = resolvePlanCoverage(line.plan, line.semesterId, section.daysOfWeek, semesters, paidAt);
    if (!coverage) throw new Error('The class has no remaining dates to register for');

    const subscriptionLine =
      line.plan === 'monthly'
        ? (await getBillingSubscriptionRepository().findLiveByUserAndSource(order.userId, CLASS_SOURCE_TYPE, section.id))
            .flatMap((subscription) => subscription.lines.map((subLine) => ({ subscription, subLine })))
            .find(({ subLine }) => subLine.orderLineId === orderLine.id)
        : undefined;

    await registrations.create({
      userId: order.userId,
      attendee,
      sectionId: section.id,
      courseId: course.id,
      schoolYearId: schoolYear.id,
      plan: line.plan,
      ...(line.semesterId ? { semesterId: line.semesterId } : {}),
      startsAt: coverage.startsAt,
      endsAt: coverage.endsAt,
      orderId: order.id,
      orderLineId: orderLine.id,
      ...(subscriptionLine
        ? { subscriptionId: subscriptionLine.subscription.id, subscriptionLineId: subscriptionLine.subLine.id }
        : {}),
      status: 'active',
      seatReleased: false,
    });
  },

  // A monthly plan stopped billing - cancelled by the family, by an admin, or by failed renewals -
  // or reached its last month. The dancer attends through the period already paid for; the seat
  // is handed back once that passes (see releaseExpiredClassSeats).
  onSubscriptionLineEnded: async (
    subLine: BillingSubscriptionLine,
    subscription: BillingSubscriptionEntity,
    paidThrough: Date | undefined,
  ) => {
    const registrations = getClassRegistrationRepository();
    const registration = await registrations.findByOrderLineId(subLine.orderLineId);
    if (!registration || registration.status !== 'active') return;

    if (subscription.status === 'ended') {
      await registrations.update(registration.id, { status: 'ended' });
      return;
    }
    const now = new Date();
    const paidEnd = paidThrough ?? now;
    await registrations.update(registration.id, {
      status: 'withdrawn',
      withdrawnAt: now,
      accessEndsAt: paidEnd < registration.endsAt ? paidEnd : registration.endsAt,
    });
  },
};

export default classPurchasable;
