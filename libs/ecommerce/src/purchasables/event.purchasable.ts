import { getEventRepository, isBulkDiscountReached, isEventOnSale, resolveEventTicketPrice } from '@inithium/db';
import type { EventEntity, EventTicketTypeEntity } from '@inithium/db';
import { getStoreCurrency } from '../settings';
import type { PurchasableContext, PurchasableLineRef, PurchasableSource, ResolvedPurchasable } from './purchasable.contract';

export const EVENT_SOURCE_TYPE = 'event';

// An event ticket cart line: sourceId is the event id, variantId the ticket type, quantity the
// number of tickets. No attendee is recorded - anyone can use a ticket.
const loadTicket = async (ref: PurchasableLineRef): Promise<{ event: EventEntity; ticketType: EventTicketTypeEntity } | null> => {
  const event = await getEventRepository().findById(ref.sourceId);
  if (!event?.isPublished) return null;
  const ticketType = event.ticketTypes.find((candidate) => candidate.id === ref.variantId);
  return ticketType ? { event, ticketType } : null;
};

// Every ticket for this event being bought together, across all ticket types - what the
// multi-ticket discount counts. Falls back to this line alone when priced by itself.
const countEventTickets = (ref: PurchasableLineRef, ctx: PurchasableContext): number =>
  ctx.lines
    ? ctx.lines
        .filter((line) => line.sourceType === EVENT_SOURCE_TYPE && line.sourceId === ref.sourceId)
        .reduce((sum, line) => sum + line.quantity, 0)
    : ref.quantity;

// Calendar dates are stored as UTC midnight - formatted in UTC so they never shift a day.
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

// Amounts are minor units in the store currency - its own fraction digits decide the divisor.
const formatMinorUnits = (amountMinor: number, currency: string): string => {
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() });
  return formatter.format(amountMinor / 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2));
};

const bulkLabel = (event: EventEntity, currency: string): string | undefined => {
  const bulk = event.bulkDiscount;
  if (!bulk) return undefined;
  const amount = bulk.kind === 'percent' ? `${bulk.value}%` : formatMinorUnits(bulk.value, currency);
  return `Group price: ${amount} off each ticket (${bulk.minTickets}+ tickets)`;
};

const eventPurchasable: PurchasableSource = {
  sourceType: EVENT_SOURCE_TYPE,

  resolve: async (ref: PurchasableLineRef, ctx: PurchasableContext): Promise<ResolvedPurchasable | null> => {
    const ticket = await loadTicket(ref);
    if (!ticket || !isEventOnSale(ticket.event, ctx.now)) return null;
    const { event, ticketType } = ticket;
    const ticketCount = countEventTickets(ref, ctx);

    return {
      name: `${event.title} · ${ticketType.name}`,
      description: [
        dateFormatter.format(event.date),
        isBulkDiscountReached(event.bulkDiscount, ticketCount) ? bulkLabel(event, await getStoreCurrency()) : undefined,
      ]
        .filter(Boolean)
        .join(' · '),
      ...(event.imageUrl ? { imageUrl: event.imageUrl } : {}),
      href: `/events/${event.slug}`,
      unitAmountCents: resolveEventTicketPrice(ticketType.priceCents, event.bulkDiscount, ticketCount),
      categories: [],
      requiresShipping: false,
      billing: { type: 'one_time' },
    };
  },

  validate: async (ref, _resolved, ctx) => {
    const ticket = await loadTicket(ref);
    if (!ticket) return { ok: false, reason: 'These tickets are no longer available.' };
    if (!isEventOnSale(ticket.event, ctx.now)) return { ok: false, reason: 'Ticket sales for this event have closed.' };
    return { ok: true };
  },
};

export default eventPurchasable;
