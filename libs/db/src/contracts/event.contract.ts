import type { ClearableUpdate } from './commerce.contract';
import type { UserProfileBannerConfig } from './user.contract';

export const EVENT_IMAGE_SOURCE_TYPES = ['cloud', 'external'] as const;
export type EventImageSourceType = (typeof EVENT_IMAGE_SOURCE_TYPES)[number];

export type EventBannerConfig = Omit<UserProfileBannerConfig, 'imageUrl'>;

// percent - `value` is 1-100, taken off every ticket
// fixed   - `value` is cents taken off every ticket (never below free)
export const EVENT_BULK_DISCOUNT_KINDS = ['percent', 'fixed'] as const;
export type EventBulkDiscountKind = (typeof EVENT_BULK_DISCOUNT_KINDS)[number];

// Applies to every ticket of the event once the buyer has at least `minTickets` of them, counted
// across all ticket types together.
export interface EventBulkDiscount {
  minTickets: number;
  kind: EventBulkDiscountKind;
  value: number;
}

// A priced admission tier ("Adult", "Child", "Under 3"). May be free.
export interface EventTicketTypeEntity {
  id: string;
  name: string;
  priceCents: number;
}

// A ticketed single-day happening (a recital, a showcase) - not a class, so no attendee is tied to
// a ticket and there's no seat limit.
export interface EventEntity {
  id: string;
  title: string;
  // Public page: /events/:slug.
  slug: string;
  description?: string;
  attendeeNotes?: string;
  // UTC midnight of the calendar date; times are 24-hour "HH:mm" studio wall-clock times.
  date: Date;
  startTime: string;
  endTime?: string;
  doorsOpenTime?: string;
  // Instants in the studio's timezone, derived when the event is saved. endsAt is the end time,
  // or the end of the event's day when no end time is given.
  startsAt: Date;
  endsAt: Date;
  // Optional admin cut-off (wall-clock date + time, and its derived instant); sales otherwise
  // close when the event starts.
  salesCloseDate?: Date;
  salesCloseTime?: string;
  salesClosesAt?: Date;
  // At the studio unless a venue is given.
  isAtStudio: boolean;
  venueName?: string;
  venueAddress?: string;
  ticketTypes: EventTicketTypeEntity[];
  bulkDiscount?: EventBulkDiscount;
  imageUrl?: string;
  imageSourceType?: EventImageSourceType;
  imageAssetId?: string;
  banner?: EventBannerConfig;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Ticket types keep their id across edits so tickets already in shoppers' carts stay valid.
export type EventTicketTypeInput = Omit<EventTicketTypeEntity, 'id'> & { id?: string };

export type CreateEventInput = Omit<EventEntity, 'id' | 'ticketTypes' | 'createdAt' | 'updatedAt'> & {
  ticketTypes: EventTicketTypeInput[];
};
export type UpdateEventInput = ClearableUpdate<Omit<CreateEventInput, 'ticketTypes'>> & { ticketTypes?: EventTicketTypeInput[] };

export interface EventRepository {
  // Unpaged - a studio runs a handful of events a year.
  findAll: () => Promise<EventEntity[]>;
  findById: (id: string) => Promise<EventEntity | null>;
  findBySlug: (slug: string) => Promise<EventEntity | null>;
  create: (input: CreateEventInput) => Promise<EventEntity>;
  update: (id: string, input: UpdateEventInput) => Promise<EventEntity | null>;
  delete: (id: string) => Promise<boolean>;
}
