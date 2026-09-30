import { eventSalesCloseAt, getEventBySlug, listEvents } from '@inithium/db';
import type { EventEntity } from '@inithium/db';

// on_sale      - tickets can be bought
// sales_closed - sales have ended but the event hasn't finished yet
// past         - the event is over
export type EventStatus = 'on_sale' | 'sales_closed' | 'past';

const statusOf = (event: EventEntity, now: Date): EventStatus => {
  if (now >= event.endsAt) return 'past';
  return now < eventSalesCloseAt(event) ? 'on_sale' : 'sales_closed';
};

export interface PublicEventDto {
  id: string;
  title: string;
  slug: string;
  description?: string;
  attendeeNotes?: string;
  date: Date;
  startTime: string;
  endTime?: string;
  doorsOpenTime?: string;
  salesCloseAt: Date;
  isAtStudio: boolean;
  venueName?: string;
  venueAddress?: string;
  ticketTypes: EventEntity['ticketTypes'];
  bulkDiscount?: EventEntity['bulkDiscount'];
  imageUrl?: string;
  banner?: EventEntity['banner'];
  status: EventStatus;
}

export const toPublicEventDto = (event: EventEntity, now: Date): PublicEventDto => ({
  id: event.id,
  title: event.title,
  slug: event.slug,
  ...(event.description ? { description: event.description } : {}),
  ...(event.attendeeNotes ? { attendeeNotes: event.attendeeNotes } : {}),
  date: event.date,
  startTime: event.startTime,
  ...(event.endTime ? { endTime: event.endTime } : {}),
  ...(event.doorsOpenTime ? { doorsOpenTime: event.doorsOpenTime } : {}),
  salesCloseAt: eventSalesCloseAt(event),
  isAtStudio: event.isAtStudio,
  ...(!event.isAtStudio && event.venueName ? { venueName: event.venueName } : {}),
  ...(!event.isAtStudio && event.venueAddress ? { venueAddress: event.venueAddress } : {}),
  ticketTypes: event.ticketTypes,
  ...(event.bulkDiscount ? { bulkDiscount: event.bulkDiscount } : {}),
  ...(event.imageUrl ? { imageUrl: event.imageUrl } : {}),
  ...(event.banner ? { banner: event.banner } : {}),
  status: statusOf(event, now),
});

// Upcoming events soonest first, then past ones most recent first.
export const buildPublicEventList = async (now: Date): Promise<PublicEventDto[]> => {
  const published = (await listEvents()).filter((event) => event.isPublished);
  const upcoming = published.filter((event) => now < event.endsAt);
  const past = published.filter((event) => now >= event.endsAt).reverse();
  return [...upcoming, ...past].map((event) => toPublicEventDto(event, now));
};

// Resolves for past events too, so a shared link never 404s.
export const buildPublicEventDetail = async (slug: string, now: Date): Promise<PublicEventDto | null> => {
  const event = await getEventBySlug(slug);
  return event?.isPublished ? toPublicEventDto(event, now) : null;
};
