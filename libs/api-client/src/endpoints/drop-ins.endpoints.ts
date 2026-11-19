import type { ApiResponse } from '@inithium/api-utils';
import type { DayOfWeek } from '@inithium/db';
import { baseApi } from '../baseApi';
import type { ClassAttendeeDto } from './class-registrations.endpoints';

export const DROP_IN_SOURCE_TYPE = 'drop_in';

export interface DropInDateDto {
  // "YYYY-MM-DD"
  date: string;
  seatsLeft: number;
}

export interface DropInDatesDto {
  sectionId: string;
  priceCents: number;
  startTime: string;
  endTime: string;
  dates: DropInDateDto[];
}

export interface DropInDatesArgs {
  sectionId: string;
  // "YYYY-MM-DD"; `to` is exclusive. Default: the next six weeks.
  from?: string;
  to?: string;
}

export type DropInStatus = 'active' | 'cancelled';

export interface DropInDto {
  id: string;
  attendee: ClassAttendeeDto;
  // "YYYY-MM-DD"
  classDate: string;
  status: DropInStatus;
  isPast: boolean;
  cancelledAt?: string;
  orderId: string;
  course?: { id: string; name: string; slug: string };
  programName?: string;
  section?: { id: string; daysOfWeek: DayOfWeek[]; startTime: string; endTime: string };
  canStaffCancel: boolean;
}

// The cart line options a drop-in is added with - see the API's drop-in.purchasable.ts.
export const toDropInLineOptions = (attendee: ClassAttendeeDto, classDate: string): Record<string, string> => ({
  ...(attendee.type === 'self' ? { attendee: 'self' } : { attendee: 'child', childId: attendee.childId }),
  classDate,
});

const unwrap = <T>(response: ApiResponse<T>): T => response.data;

export const dropInsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listDropInDates: builder.query<DropInDatesDto, DropInDatesArgs>({
      query: ({ sectionId, from, to }) => {
        const params = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
        const search = params.toString();
        return `/api/classes/sections/${sectionId}/drop-in-dates${search ? `?${search}` : ''}`;
      },
      transformResponse: unwrap<DropInDatesDto>,
      providesTags: ['DropIn', 'Class'],
    }),
    listMyDropIns: builder.query<DropInDto[], void>({
      query: () => '/api/drop-ins/mine',
      transformResponse: unwrap<DropInDto[]>,
      providesTags: ['DropIn'],
    }),
    listAccountDropIns: builder.query<DropInDto[], string>({
      query: (userId) => `/api/users/${userId}/drop-ins`,
      transformResponse: unwrap<DropInDto[]>,
      providesTags: ['DropIn'],
    }),
    cancelDropIn: builder.mutation<DropInDto, string>({
      query: (id) => ({ url: `/api/drop-ins/${id}/cancel`, method: 'POST' }),
      transformResponse: unwrap<DropInDto>,
      invalidatesTags: ['DropIn'],
    }),
  }),
});

export const { useListDropInDatesQuery, useListMyDropInsQuery, useListAccountDropInsQuery, useCancelDropInMutation } = dropInsApi;
