import type { ApiResponse } from '@inithium/api-utils';
import { baseApi } from '../baseApi';

// Dates cross the HTTP boundary as ISO strings, mirroring every other plugin's own Dto precedent
// (see StaffMemberDto).
export interface TimeEntryDto {
  id: string;
  userId: string;
  typeId: string;
  startAt: string;
  endAt?: string;
  locked: boolean;
  autoClosed: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntryTypeTotalDto {
  typeId: string;
  minutes: number;
}

export interface TimeRangeParams {
  from: string;
  to: string;
}

const buildRangeQuery = ({ from, to }: TimeRangeParams): string => new URLSearchParams({ from, to }).toString();

export const timeClockApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    clockIn: builder.mutation<TimeEntryDto, { typeId: string }>({
      query: (body) => ({ url: '/api/time/clock-in', method: 'POST', body }),
      transformResponse: (response: ApiResponse<TimeEntryDto>) => response.data,
      invalidatesTags: ['TimeEntry', 'TimeAuditLog'],
    }),
    clockOut: builder.mutation<TimeEntryDto, void>({
      query: () => ({ url: '/api/time/clock-out', method: 'POST' }),
      transformResponse: (response: ApiResponse<TimeEntryDto>) => response.data,
      invalidatesTags: ['TimeEntry', 'TimeAuditLog'],
    }),
    switchTimeEntryType: builder.mutation<TimeEntryDto, { typeId: string }>({
      query: (body) => ({ url: '/api/time/switch-type', method: 'POST', body }),
      transformResponse: (response: ApiResponse<TimeEntryDto>) => response.data,
      invalidatesTags: ['TimeEntry', 'TimeAuditLog'],
    }),
    getMyTimeEntries: builder.query<TimeEntryDto[], TimeRangeParams>({
      query: (params) => `/api/time/my/entries?${buildRangeQuery(params)}`,
      transformResponse: (response: ApiResponse<TimeEntryDto[]>) => response.data,
      providesTags: ['TimeEntry'],
    }),
    getMyTimeSummary: builder.query<TimeEntryTypeTotalDto[], TimeRangeParams>({
      query: (params) => `/api/time/my/summary?${buildRangeQuery(params)}`,
      transformResponse: (response: ApiResponse<TimeEntryTypeTotalDto[]>) => response.data,
      providesTags: ['TimeEntry'],
    }),
    updateMyTimeEntry: builder.mutation<TimeEntryDto, { id: string; typeId: string }>({
      query: ({ id, typeId }) => ({ url: `/api/time/my/entries/${id}`, method: 'PATCH', body: { typeId } }),
      transformResponse: (response: ApiResponse<TimeEntryDto>) => response.data,
      invalidatesTags: ['TimeEntry', 'TimeAuditLog'],
    }),
    deleteMyTimeEntry: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/time/my/entries/${id}`, method: 'DELETE' }),
      invalidatesTags: ['TimeEntry', 'TimeAuditLog'],
    }),
  }),
});

export const {
  useClockInMutation,
  useClockOutMutation,
  useSwitchTimeEntryTypeMutation,
  useGetMyTimeEntriesQuery,
  useGetMyTimeSummaryQuery,
  useUpdateMyTimeEntryMutation,
  useDeleteMyTimeEntryMutation,
} = timeClockApi;
