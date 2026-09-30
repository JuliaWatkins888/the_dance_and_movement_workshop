import {
  describeAttendee,
  findRegisteredWorkshopDays,
  getCartRepository,
  getUserRepository,
  getWorkshopRegistrationRepository,
  getWorkshopRepository,
  isWorkshopRegistrationOpen,
  resolveEligibleAttendee,
  resolveWorkshopPrice,
} from '@inithium/db';
import type { AttendeeRef, LineOptions, OrderEntity, OrderLine, WorkshopDayEntity, WorkshopEntity } from '@inithium/db';
import type { PurchasableContext, PurchasableLineRef, PurchasableSource, ResolvedPurchasable } from './purchasable.contract';

export const WORKSHOP_SOURCE_TYPE = 'workshop';

// A workshop cart line: sourceId is the workshop id; options say who attends and which days -
// { attendee: 'self' } or { attendee: 'child', childId }, plus { days: '<dayId>,<dayId>' }. Day
// ids are sorted so the same selection always merges into one line.
interface WorkshopLine {
  workshopId: string;
  attendee: AttendeeRef;
  dayIds: string[];
}

const parseWorkshopLine = (workshopId: string, options: LineOptions): WorkshopLine | null => {
  const dayIds = (options['days'] ?? '').split(',').filter(Boolean);
  if (dayIds.length === 0 || new Set(dayIds).size !== dayIds.length) return null;
  const attendee: AttendeeRef | null =
    options['attendee'] === 'self'
      ? { type: 'self' }
      : options['attendee'] === 'child' && options['childId']
        ? { type: 'child', childId: options['childId'] }
        : null;
  return attendee ? { workshopId, attendee, dayIds } : null;
};

const sameAttendee = (a: AttendeeRef, b: AttendeeRef): boolean =>
  a.type === 'self' ? b.type === 'self' : b.type === 'child' && a.childId === b.childId;

// The published workshop plus the chosen days, or null when it's hidden or a day no longer exists.
const loadSelection = async (line: WorkshopLine): Promise<{ workshop: WorkshopEntity; days: WorkshopDayEntity[] } | null> => {
  const workshop = await getWorkshopRepository().findById(line.workshopId);
  if (!workshop?.isPublished) return null;
  const days = workshop.days.filter((day) => line.dayIds.includes(day.id));
  return days.length === line.dayIds.length ? { workshop, days } : null;
};

// Calendar dates are stored as UTC midnight - formatted in UTC so they never shift a day.
const dayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const formatDay = (day: WorkshopDayEntity): string => dayFormatter.format(day.date);

const selectionLabel = (workshop: WorkshopEntity, days: WorkshopDayEntity[]): string => {
  const price = resolveWorkshopPrice(workshop, days.length);
  if (!price.isFullWorkshop) return days.map(formatDay).join(', ');
  const all = workshop.days.length === 1 ? formatDay(workshop.days[0] as WorkshopDayEntity) : `All ${workshop.days.length} days`;
  return price.discountPercent > 0 ? `${all} (save ${price.discountPercent}%)` : all;
};

const loadUserName = async (userId: string): Promise<string> => {
  const user = await getUserRepository().findById(userId);
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ');
};

const workshopPurchasable: PurchasableSource = {
  sourceType: WORKSHOP_SOURCE_TYPE,

  resolve: async (ref: PurchasableLineRef, ctx: PurchasableContext): Promise<ResolvedPurchasable | null> => {
    const line = parseWorkshopLine(ref.sourceId, ref.options);
    const selection = line ? await loadSelection(line) : null;
    if (!line || !selection || !isWorkshopRegistrationOpen(selection.workshop.days, ctx.now)) return null;
    const { workshop, days } = selection;

    const name = (await describeAttendee(ctx.userId, await loadUserName(ctx.userId), line.attendee))?.name;
    return {
      name: workshop.title,
      description: [selectionLabel(workshop, days), name ? `for ${name}` : undefined].filter(Boolean).join(' · '),
      ...(workshop.imageUrl ? { imageUrl: workshop.imageUrl } : {}),
      href: `/workshops/${workshop.slug}`,
      unitAmountCents: resolveWorkshopPrice(workshop, days.length).amountCents,
      categories: [],
      requiresShipping: false,
      maxQuantity: 1,
      billing: { type: 'one_time' },
    };
  },

  validate: async (ref, _resolved, ctx) => {
    const line = parseWorkshopLine(ref.sourceId, ref.options);
    const selection = line ? await loadSelection(line) : null;
    if (!line || !selection) return { ok: false, reason: 'This workshop is no longer available.' };
    if (ref.quantity !== 1)
      return {
        ok: false,
        reason: 'Each dancer can only be registered once per workshop.',
      };
    const { workshop, days } = selection;
    if (!isWorkshopRegistrationOpen(workshop.days, ctx.now)) {
      return {
        ok: false,
        reason: 'Registration for this workshop has closed.',
      };
    }

    const attendee = await resolveEligibleAttendee(
      ctx.userId,
      await loadUserName(ctx.userId),
      line.attendee,
      workshop,
      ctx.now,
      'workshop',
    );
    if (!attendee.ok) return { ok: false, reason: attendee.reason };

    const fullDay = days.find((day) => day.enrolled >= day.capacity);
    if (fullDay) return { ok: false, reason: `${formatDay(fullDay)} is full.` };

    const alreadyRegistered = await findRegisteredWorkshopDays(ctx.userId, workshop.id, line.attendee, line.dayIds);
    if (alreadyRegistered.length > 0) {
      const labels = days.filter((day) => alreadyRegistered.includes(day.id)).map(formatDay);
      return {
        ok: false,
        reason: `${attendee.attendee.name} is already registered for ${labels.join(', ')}.`,
      };
    }

    // Another line for the same dancer and workshop sharing a day - an identical selection merges
    // instead, so it never lands here.
    const cart = await getCartRepository().findByUserId(ctx.userId);
    const conflicting = (cart?.lines ?? []).some((cartLine) => {
      if (cartLine.sourceType !== WORKSHOP_SOURCE_TYPE || cartLine.sourceId !== ref.sourceId) return false;
      const other = parseWorkshopLine(cartLine.sourceId, cartLine.options);
      if (!other || !sameAttendee(other.attendee, line.attendee)) return false;
      if (other.dayIds.join(',') === line.dayIds.join(',')) return false;
      return other.dayIds.some((dayId) => line.dayIds.includes(dayId));
    });
    if (conflicting)
      return {
        ok: false,
        reason: `${attendee.attendee.name} already has some of these days in the cart.`,
      };

    return { ok: true };
  },

  // All-or-nothing across the chosen days.
  reserve: async (ref) => {
    const line = parseWorkshopLine(ref.sourceId, ref.options);
    if (!line) return false;
    const repository = getWorkshopRepository();
    const claimed: string[] = [];
    for (const dayId of line.dayIds) {
      if (!(await repository.reserveDaySeat(line.workshopId, dayId))) {
        await Promise.all(claimed.map((claimedDayId) => repository.releaseDaySeat(line.workshopId, claimedDayId)));
        return false;
      }
      claimed.push(dayId);
    }
    return true;
  },

  release: async (ref) => {
    const line = parseWorkshopLine(ref.sourceId, ref.options);
    if (!line) return;
    const repository = getWorkshopRepository();
    await Promise.all(line.dayIds.map((dayId) => repository.releaseDaySeat(line.workshopId, dayId)));
  },

  // The seats were reserved before payment; this records the enrollment. Safe to run twice - the
  // registration is keyed by its order line.
  onPaid: async (orderLine: OrderLine, order: OrderEntity) => {
    const registrations = getWorkshopRegistrationRepository();
    if (await registrations.findByOrderLineId(orderLine.id)) return;

    const line = parseWorkshopLine(orderLine.sourceId, orderLine.options);
    if (!line) throw new Error('Workshop line has unreadable options');
    const workshop = await getWorkshopRepository().findById(line.workshopId);
    if (!workshop) throw new Error('The workshop was deleted before its registration could be recorded');

    // Eligibility was checked at checkout; this only snapshots who attends.
    const attendee = await describeAttendee(order.userId, await loadUserName(order.userId), line.attendee);
    if (!attendee) throw new Error('The dancer on this registration is no longer on the account');

    await registrations.create({
      userId: order.userId,
      attendee,
      workshopId: workshop.id,
      dayIds: line.dayIds,
      isFullWorkshop: resolveWorkshopPrice(workshop, line.dayIds.length).isFullWorkshop,
      orderId: order.id,
      orderLineId: orderLine.id,
    });
  },
};

export default workshopPurchasable;
