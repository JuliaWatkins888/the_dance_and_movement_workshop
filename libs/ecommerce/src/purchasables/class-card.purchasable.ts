import { describeAttendee, getClassCardRepository, getClassCardTypeRepository, resolveEligibleAttendee } from '@inithium/db';
import type { OrderEntity, OrderLine } from '@inithium/db';
import { loadUserName, parseAttendee } from './class-section-context';
import type { PurchasableContext, PurchasableLineRef, PurchasableSource, ResolvedPurchasable } from './purchasable.contract';

export const CLASS_CARD_SOURCE_TYPE = 'class_card';

// Cards are sold to adults only - the same 18+ line adult courses use.
const ADULT_ONLY = { minAgeYears: 18 };
const CATEGORY = 'Class Cards';

// A class-card cart line: sourceId is the card type id; options say who the card is for -
// { attendee: 'self' } or { attendee: 'child', childId } (an 18+ student on the account).
const classCardPurchasable: PurchasableSource = {
  sourceType: CLASS_CARD_SOURCE_TYPE,
  requiresPolicyConsent: true,

  resolve: async (ref: PurchasableLineRef, ctx: PurchasableContext): Promise<ResolvedPurchasable | null> => {
    const cardType = await getClassCardTypeRepository().findById(ref.sourceId);
    const attendee = parseAttendee(ref.options);
    if (!cardType?.isActive || !attendee) return null;

    const name = (await describeAttendee(ctx.userId, await loadUserName(ctx.userId), attendee))?.name;
    return {
      name: cardType.name,
      description: [`${cardType.classCount} adult classes · never expires`, name ? `for ${name}` : undefined].filter(Boolean).join(' · '),
      href: '/classes',
      unitAmountCents: cardType.priceCents,
      categories: [CATEGORY],
      requiresShipping: false,
      maxQuantity: 1,
      billing: { type: 'one_time' },
    };
  },

  validate: async (ref, _resolved, ctx) => {
    const attendee = parseAttendee(ref.options);
    if (!attendee) return { ok: false, reason: 'Choose who the class card is for.' };
    if (ref.quantity !== 1) return { ok: false, reason: 'Add one class card per person at a time.' };
    const resolution = await resolveEligibleAttendee(ctx.userId, await loadUserName(ctx.userId), attendee, ADULT_ONLY, ctx.now, 'class card');
    if (!resolution.ok) {
      return { ok: false, reason: attendee.type === 'child' ? 'Class cards are for adults 18 and over.' : resolution.reason };
    }
    return { ok: true };
  },

  // Safe to run twice - the card is keyed by its order line.
  onPaid: async (orderLine: OrderLine, order: OrderEntity) => {
    const cards = getClassCardRepository();
    if (await cards.findByOrderLineId(orderLine.id)) return;

    const attendeeRef = parseAttendee(orderLine.options);
    if (!attendeeRef) throw new Error('Class card line has unreadable options');
    const cardType = await getClassCardTypeRepository().findById(orderLine.sourceId);
    if (!cardType) throw new Error('The class card type was deleted before the card could be issued');
    const attendee = await describeAttendee(order.userId, await loadUserName(order.userId), attendeeRef);
    if (!attendee) throw new Error('The person on this class card is no longer on the account');

    await cards.create({
      userId: order.userId,
      attendee,
      cardTypeId: cardType.id,
      name: cardType.name,
      classesTotal: cardType.classCount,
      orderId: order.id,
      orderLineId: orderLine.id,
    });
  },

  // A refunded card is cancelled outright; classes already used stay in its history.
  onRefunded: async (orderLine: OrderLine) => {
    const cards = getClassCardRepository();
    const card = await cards.findByOrderLineId(orderLine.id);
    if (card) await cards.cancel(card.id, new Date());
  },
};

export default classCardPurchasable;
