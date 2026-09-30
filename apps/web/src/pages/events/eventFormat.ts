import type { EventBulkDiscountDto, PublicEventDto } from '@inithium/api-client';
import { STUDIO_ADDRESS, STUDIO_NAME } from '../../app/studioLocation';
import { formatCents, formatTime12h } from '../classes/classFormat';

// Calendar dates are stored as UTC midnight - formatted in UTC so they never shift a day.
const longDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export const formatEventDateLong = (iso: string): string => longDateFormatter.format(new Date(iso));
export const formatEventDateShort = (iso: string): string => shortDateFormatter.format(new Date(iso));

export const formatEventTimes = (event: Pick<PublicEventDto, 'startTime' | 'endTime'>): string =>
  event.endTime ? `${formatTime12h(event.startTime)} – ${formatTime12h(event.endTime)}` : formatTime12h(event.startTime);

export const eventLocation = (
  event: Pick<PublicEventDto, 'isAtStudio' | 'venueName' | 'venueAddress'>,
): { name: string; address: string } =>
  event.isAtStudio ? { name: STUDIO_NAME, address: STUDIO_ADDRESS } : { name: event.venueName ?? '', address: event.venueAddress ?? '' };

export const formatTicketPrice = (cents: number): string => (cents === 0 ? 'Free' : formatCents(cents));

// "$15", "From $10", or "Free" across the event's ticket types.
export const priceSummary = (event: PublicEventDto): string => {
  const prices = event.ticketTypes.map((ticketType) => ticketType.priceCents);
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  if (highest === 0) return 'Free';
  return lowest === highest ? formatCents(lowest) : `From ${formatTicketPrice(lowest)}`;
};

export const bulkDiscountSummary = (bulk: EventBulkDiscountDto): string =>
  `${bulk.kind === 'percent' ? `${bulk.value}%` : formatCents(bulk.value)} off each ticket when you buy ${bulk.minTickets} or more`;

// Mirrors the API's resolveEventTicketPrice: the discount applies to every ticket once the total
// across all ticket types reaches the threshold, and never takes a ticket below free.
export const ticketUnitPrice = (priceCents: number, bulk: EventBulkDiscountDto | undefined, totalTickets: number): number => {
  if (!bulk || totalTickets < bulk.minTickets) return priceCents;
  return bulk.kind === 'percent' ? Math.round((priceCents * (100 - bulk.value)) / 100) : Math.max(0, priceCents - bulk.value);
};

export const availabilityLabel = (event: PublicEventDto): string => {
  if (event.status === 'past') return 'Ended';
  if (event.status === 'sales_closed') return 'Ticket sales closed';
  return 'Tickets on sale';
};

export interface EventFilters {
  readonly search: string;
  // "YYYY-MM-DD" bounds on the event date.
  readonly from?: string;
  readonly to?: string;
}

export const filterEvents = (events: PublicEventDto[], filters: EventFilters): PublicEventDto[] => {
  const query = filters.search.trim().toLowerCase();
  return events.filter((event) => {
    const date = event.date.slice(0, 10);
    if (filters.from && date < filters.from) return false;
    if (filters.to && date > filters.to) return false;
    if (!query) return true;
    return [event.title, eventLocation(event).name, event.description ?? ''].join(' ').toLowerCase().includes(query);
  });
};
