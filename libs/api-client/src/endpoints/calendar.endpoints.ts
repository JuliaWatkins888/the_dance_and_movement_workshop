import type { ApiResponse } from '@inithium/api-utils';
import { baseApi } from '../baseApi';

export type CalendarItemKind = 'class' | 'workshop' | 'event' | 'holiday' | 'entry';

// What the public legend toggles - holidays share a bucket with admin closures.
export type CalendarItemCategory = 'classes' | 'workshops' | 'events' | 'closures' | 'other';

export interface CalendarItemLocationDto {
  isAtStudio: boolean;
  venueName?: string;
  venueAddress?: string;
}

// Times are studio wall-clock with no offset: "YYYY-MM-DD" for an all-day item (its end is
// exclusive), otherwise "YYYY-MM-DDTHH:mm".
export interface CalendarItemDto {
  id: string;
  kind: CalendarItemKind;
  category: CalendarItemCategory;
  title: string;
  subtitle?: string;
  start: string;
  end?: string;
  allDay: boolean;
  // The public page the item opens; absent for holidays and admin entries, which open in place.
  href?: string;
  isStudioClosed?: boolean;
  description?: string;
  location?: CalendarItemLocationDto;
  linkUrl?: string;
}

export interface CalendarRangeArgs {
  // "YYYY-MM-DD"; `to` is exclusive.
  from: string;
  to: string;
}

export interface CalendarEntryDto {
  id: string;
  title: string;
  description?: string;
  // UTC midnight of the calendar dates, both inclusive.
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  isStudioClosed: boolean;
  isAtStudio: boolean;
  venueName?: string;
  venueAddress?: string;
  linkUrl?: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

// The CMS always saves the whole entry - an optional field left out is cleared.
export interface CalendarEntryWriteInput {
  title: string;
  description?: string;
  // "YYYY-MM-DD" and 24-hour "HH:mm" studio wall-clock values. Times are set together or not at all.
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  isStudioClosed: boolean;
  isAtStudio: boolean;
  venueName?: string;
  venueAddress?: string;
  linkUrl?: string;
  isPublished?: boolean;
}

export interface HolidayDto {
  key: string;
  name: string;
  // "YYYY-MM-DD" - the holiday's actual date.
  date: string;
  isStudioClosed: boolean;
}

const unwrap = <T>(response: ApiResponse<T>): T => response.data;

export const calendarApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Class sessions, workshop days, and events are derived from their own modules, so edits there
    // refresh the calendar too.
    getCalendar: builder.query<CalendarItemDto[], CalendarRangeArgs>({
      query: ({ from, to }) => ({ url: '/api/calendar', params: { from, to } }),
      transformResponse: unwrap<CalendarItemDto[]>,
      providesTags: ['Calendar', 'Class', 'SchoolYear', 'Workshop', 'Event'],
    }),

    listCalendarEntriesAdmin: builder.query<CalendarEntryDto[], void>({
      query: () => '/api/calendar/admin/entries',
      transformResponse: unwrap<CalendarEntryDto[]>,
      providesTags: ['Calendar'],
    }),
    createCalendarEntry: builder.mutation<CalendarEntryDto, CalendarEntryWriteInput>({
      query: (input) => ({ url: '/api/calendar/entries', method: 'POST', body: input }),
      transformResponse: unwrap<CalendarEntryDto>,
      invalidatesTags: ['Calendar'],
    }),
    updateCalendarEntry: builder.mutation<CalendarEntryDto, CalendarEntryWriteInput & { id: string }>({
      query: ({ id, ...input }) => ({ url: `/api/calendar/entries/${id}`, method: 'PUT', body: input }),
      transformResponse: unwrap<CalendarEntryDto>,
      invalidatesTags: ['Calendar'],
    }),
    deleteCalendarEntry: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/calendar/entries/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Calendar'],
    }),

    listHolidaysAdmin: builder.query<HolidayDto[], number>({
      query: (year) => ({ url: '/api/calendar/admin/holidays', params: { year } }),
      transformResponse: unwrap<HolidayDto[]>,
      providesTags: ['Calendar'],
    }),
    setHolidayStudioOpen: builder.mutation<HolidayDto, { date: string; isStudioOpen: boolean }>({
      query: ({ date, isStudioOpen }) => ({ url: `/api/calendar/admin/holidays/${date}`, method: 'PUT', body: { isStudioOpen } }),
      transformResponse: unwrap<HolidayDto>,
      invalidatesTags: ['Calendar'],
    }),
  }),
});

export const {
  useGetCalendarQuery,
  useListCalendarEntriesAdminQuery,
  useCreateCalendarEntryMutation,
  useUpdateCalendarEntryMutation,
  useDeleteCalendarEntryMutation,
  useListHolidaysAdminQuery,
  useSetHolidayStudioOpenMutation,
} = calendarApi;
