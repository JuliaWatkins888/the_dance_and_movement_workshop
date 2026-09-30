import type { ApiResponse } from '@inithium/api-utils';
import { baseApi } from '../baseApi';
import type { ProgramBannerDto, ProgramImageSourceType } from './classes.endpoints';

// Frontend-facing shapes - dates cross the HTTP boundary as ISO strings. Money is integer cents.

export type EventStatus = 'on_sale' | 'sales_closed' | 'past';

export type EventBulkDiscountKind = 'percent' | 'fixed';

// Taken off every ticket once the buyer has `minTickets` tickets for the event, all types combined.
export interface EventBulkDiscountDto {
  minTickets: number;
  kind: EventBulkDiscountKind;
  // Percent (1-100) or cents off each ticket.
  value: number;
}

export interface EventTicketTypeDto {
  id: string;
  name: string;
  priceCents: number;
}

export interface PublicEventDto {
  id: string;
  title: string;
  slug: string;
  description?: string;
  attendeeNotes?: string;
  // UTC midnight of the calendar date; times are 24-hour studio wall-clock "HH:mm".
  date: string;
  startTime: string;
  endTime?: string;
  doorsOpenTime?: string;
  salesCloseAt: string;
  isAtStudio: boolean;
  venueName?: string;
  venueAddress?: string;
  ticketTypes: EventTicketTypeDto[];
  bulkDiscount?: EventBulkDiscountDto;
  imageUrl?: string;
  banner?: ProgramBannerDto;
  status: EventStatus;
}

export interface EventDto {
  id: string;
  title: string;
  slug: string;
  description?: string;
  attendeeNotes?: string;
  date: string;
  startTime: string;
  endTime?: string;
  doorsOpenTime?: string;
  startsAt: string;
  endsAt: string;
  salesCloseDate?: string;
  salesCloseTime?: string;
  salesClosesAt?: string;
  isAtStudio: boolean;
  venueName?: string;
  venueAddress?: string;
  ticketTypes: EventTicketTypeDto[];
  bulkDiscount?: EventBulkDiscountDto;
  imageUrl?: string;
  imageSourceType?: ProgramImageSourceType;
  imageAssetId?: string;
  banner?: ProgramBannerDto;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

// The CMS always saves the whole event - an optional field left out is cleared.
export interface EventWriteInput {
  title: string;
  slug: string;
  description?: string;
  attendeeNotes?: string;
  // "YYYY-MM-DD" and 24-hour "HH:mm" studio wall-clock values.
  date: string;
  startTime: string;
  endTime?: string;
  doorsOpenTime?: string;
  salesCloseDate?: string;
  salesCloseTime?: string;
  isAtStudio: boolean;
  venueName?: string;
  venueAddress?: string;
  ticketTypes: { id?: string; name: string; priceCents: number }[];
  bulkDiscount?: EventBulkDiscountDto;
  imageUrl?: string;
  imageSourceType?: ProgramImageSourceType;
  imageAssetId?: string;
  banner?: ProgramBannerDto;
  isPublished?: boolean;
}

// An event ticket cart line: sourceId is the event, variantId the ticket type, quantity the count.
export const EVENT_SOURCE_TYPE = 'event';

const unwrap = <T>(response: ApiResponse<T>): T => response.data;

export const eventsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listEvents: builder.query<PublicEventDto[], void>({
      query: () => '/api/events',
      transformResponse: unwrap<PublicEventDto[]>,
      providesTags: ['Event'],
    }),
    getEventBySlug: builder.query<PublicEventDto, string>({
      query: (slug) => `/api/events/${encodeURIComponent(slug)}`,
      transformResponse: unwrap<PublicEventDto>,
      providesTags: ['Event'],
    }),

    listEventsAdmin: builder.query<EventDto[], void>({
      query: () => '/api/events/admin/all',
      transformResponse: unwrap<EventDto[]>,
      providesTags: ['Event'],
    }),
    createEvent: builder.mutation<EventDto, EventWriteInput>({
      query: (input) => ({ url: '/api/events', method: 'POST', body: input }),
      transformResponse: unwrap<EventDto>,
      invalidatesTags: ['Event'],
    }),
    // Ticket prices can change, so carts are re-priced too.
    updateEvent: builder.mutation<EventDto, EventWriteInput & { id: string }>({
      query: ({ id, ...input }) => ({ url: `/api/events/${id}`, method: 'PUT', body: input }),
      transformResponse: unwrap<EventDto>,
      invalidatesTags: ['Event', 'Cart'],
    }),
    deleteEvent: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/events/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Event', 'Cart'],
    }),
  }),
});

export const {
  useListEventsQuery,
  useGetEventBySlugQuery,
  useListEventsAdminQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
} = eventsApi;
