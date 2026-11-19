import {
  attendeeKey,
  checkDropInDate,
  dateKeyToUtc,
  describeAttendee,
  findOverlappingRegistration,
  getClassSectionRepository,
  getDropInRegistrationRepository,
  isValidDateKey,
  releaseExpiredClassSeats,
  resolveEligibleAttendee,
} from '@inithium/db';
import type { AttendeeRef, DropInDateCheck, LineOptions, OrderEntity, OrderLine } from '@inithium/db';
import { loadSectionContext, loadUserName, parseAttendee, sectionLabel } from './class-section-context';
import type { PurchasableContext, PurchasableLineRef, PurchasableSource, ResolvedPurchasable } from './purchasable.contract';

export const DROP_IN_SOURCE_TYPE = 'drop_in';

const DAY_MS = 86_400_000;

// A drop-in cart line: sourceId is the section id; options say who attends and which class -
// { attendee: 'self' } or { attendee: 'child', childId }, plus { classDate: 'YYYY-MM-DD' }.
interface DropInLine {
  sectionId: string;
  attendee: AttendeeRef;
  classDate: string;
}

const parseDropInLine = (sectionId: string, options: LineOptions): DropInLine | null => {
  const classDate = options['classDate'];
  const attendee = parseAttendee(options);
  if (!attendee || !classDate || !isValidDateKey(classDate)) return null;
  return { sectionId, attendee, classDate };
};

// Calendar dates are UTC midnight - formatted in UTC so they never shift a day.
const dateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const formatClassDate = (dateKey: string): string => dateFormatter.format(dateKeyToUtc(dateKey));

const DATE_REASONS: Record<Exclude<DropInDateCheck, 'ok'>, (label: string) => string> = {
  not_scheduled: (label) => `This class doesn’t meet on ${label}.`,
  closed: (label) => `The studio is closed on ${label}.`,
  started: (label) => `Drop-ins for ${label} closed when the class started.`,
};

const dropInPurchasable: PurchasableSource = {
  sourceType: DROP_IN_SOURCE_TYPE,
  requiresPolicyConsent: true,
  policySchoolYearId: async (ref) => (await getClassSectionRepository().findById(ref.sourceId))?.schoolYearId ?? null,

  resolve: async (ref: PurchasableLineRef, ctx: PurchasableContext): Promise<ResolvedPurchasable | null> => {
    const line = parseDropInLine(ref.sourceId, ref.options);
    const section = line ? await loadSectionContext(line.sectionId) : null;
    const priceCents = section?.course.dropInPriceCents;
    if (!line || !section || priceCents === undefined) return null;

    const name = (await describeAttendee(ctx.userId, await loadUserName(ctx.userId), line.attendee))?.name;
    return {
      name: `${section.course.name} · ${sectionLabel(section.section)}`,
      description: [`Drop-in · ${formatClassDate(line.classDate)}`, name ? `for ${name}` : undefined].filter(Boolean).join(' · '),
      ...(section.program.imageUrl ? { imageUrl: section.program.imageUrl } : {}),
      href: `/classes/${section.course.slug}?section=${section.section.id}`,
      unitAmountCents: priceCents,
      categories: [section.program.name],
      requiresShipping: false,
      maxQuantity: 1,
      billing: { type: 'one_time' },
    };
  },

  validate: async (ref, _resolved, ctx) => {
    const line = parseDropInLine(ref.sourceId, ref.options);
    const section = line ? await loadSectionContext(line.sectionId) : null;
    if (!line || !section || section.course.dropInPriceCents === undefined) {
      return { ok: false, reason: 'Drop-ins aren’t available for this class.' };
    }
    if (ref.quantity !== 1) return { ok: false, reason: 'Each dancer can only drop in once per class.' };

    const opensAt = section.schoolYear.registrationOpensAt;
    if (opensAt && opensAt > ctx.now) return { ok: false, reason: 'Registration for this class hasn’t opened yet.' };

    const label = formatClassDate(line.classDate);
    const dateCheck = await checkDropInDate(section.section, section.semesters, line.classDate, ctx.now);
    if (dateCheck !== 'ok') return { ok: false, reason: DATE_REASONS[dateCheck](label) };

    const attendee = await resolveEligibleAttendee(ctx.userId, await loadUserName(ctx.userId), line.attendee, section.course, ctx.now);
    if (!attendee.ok) return { ok: false, reason: attendee.reason };

    // Enrolled in this section for a term that covers the date - they already have a seat.
    const classDate = dateKeyToUtc(line.classDate);
    const day = { startsAt: classDate, endsAt: new Date(classDate.getTime() + DAY_MS) };
    if (await findOverlappingRegistration(ctx.userId, section.section.id, line.attendee, day)) {
      return { ok: false, reason: `${attendee.attendee.name} is already registered for this class.` };
    }
    const dropIns = getDropInRegistrationRepository();
    if (await dropIns.findActiveForAttendee(ctx.userId, section.section.id, classDate, attendeeKey(line.attendee))) {
      return { ok: false, reason: `${attendee.attendee.name} already has a drop-in for ${label}.` };
    }

    await releaseExpiredClassSeats(ctx.now);
    const fresh = await getClassSectionRepository().findById(section.section.id);
    const held = await dropIns.countForSectionDate(section.section.id, classDate);
    if (!fresh || fresh.enrolled + held >= fresh.capacity) return { ok: false, reason: `${label} is full.` };

    return { ok: true };
  },

  // Room on the date is whatever the term enrollments leave, less drop-ins already held.
  reserve: async (ref, ctx) => {
    const line = parseDropInLine(ref.sourceId, ref.options);
    if (!line) return false;
    await releaseExpiredClassSeats(ctx.now);
    const section = await getClassSectionRepository().findById(line.sectionId);
    if (!section) return false;
    return getDropInRegistrationRepository().reserveSeat(line.sectionId, dateKeyToUtc(line.classDate), section.capacity - section.enrolled);
  },

  release: async (ref) => {
    const line = parseDropInLine(ref.sourceId, ref.options);
    if (line) await getDropInRegistrationRepository().releaseSeat(line.sectionId, dateKeyToUtc(line.classDate));
  },

  // The seat was reserved before payment; this records the drop-in. Safe to run twice - the
  // record is keyed by its order line.
  onPaid: async (orderLine: OrderLine, order: OrderEntity) => {
    const dropIns = getDropInRegistrationRepository();
    if (await dropIns.findByOrderLineId(orderLine.id)) return;

    const line = parseDropInLine(orderLine.sourceId, orderLine.options);
    if (!line) throw new Error('Drop-in line has unreadable options');
    const section = await getClassSectionRepository().findById(line.sectionId);
    if (!section) throw new Error('The class was deleted before its drop-in could be recorded');

    // Eligibility was checked at checkout; this only snapshots who attends.
    const attendee = await describeAttendee(order.userId, await loadUserName(order.userId), line.attendee);
    if (!attendee) throw new Error('The dancer on this drop-in is no longer on the account');

    await dropIns.create({
      userId: order.userId,
      attendee,
      sectionId: section.id,
      courseId: section.courseId,
      schoolYearId: section.schoolYearId,
      classDate: dateKeyToUtc(line.classDate),
      orderId: order.id,
      orderLineId: orderLine.id,
    });
  },
};

export default dropInPurchasable;
