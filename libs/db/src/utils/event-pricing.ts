import type { EventBulkDiscount, EventEntity } from '../contracts/event.contract';
import { applyDiscount } from './class-pricing';

// Sales close at the admin's cut-off, or when the event starts.
export const eventSalesCloseAt = (event: Pick<EventEntity, 'salesClosesAt' | 'startsAt'>): Date => event.salesClosesAt ?? event.startsAt;

export const isEventOnSale = (event: Pick<EventEntity, 'salesClosesAt' | 'startsAt'>, now: Date): boolean => now < eventSalesCloseAt(event);

export const isBulkDiscountReached = (bulkDiscount: EventBulkDiscount | undefined, ticketCount: number): boolean =>
  bulkDiscount !== undefined && ticketCount >= bulkDiscount.minTickets;

// One ticket's price when the buyer holds `ticketCount` tickets for the event in total.
export const resolveEventTicketPrice = (priceCents: number, bulkDiscount: EventBulkDiscount | undefined, ticketCount: number): number => {
  if (!bulkDiscount || !isBulkDiscountReached(bulkDiscount, ticketCount)) return priceCents;
  return bulkDiscount.kind === 'percent' ? applyDiscount(priceCents, bulkDiscount.value) : Math.max(0, priceCents - bulkDiscount.value);
};
