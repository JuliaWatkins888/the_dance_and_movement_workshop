import type { ApiResponse } from '@inithium/api-utils';
import { baseApi } from '../baseApi';
import type { TimeEntryDto, TimeEntryTypeTotalDto, TimeRangeParams } from './time-clock.endpoints';

export interface TimeEmployeeDto {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  role: string;
  isOwner: boolean;
}

export interface TimeEntrySnapshotDto {
  typeId?: string;
  startAt?: string;
  endAt?: string;
  locked?: boolean;
}

export interface TimeAuditLogDto {
  id: string;
  action: string;
  actorId: string;
  before?: TimeEntrySnapshotDto;
  after?: TimeEntrySnapshotDto;
  createdAt: string;
}

export interface AdminRangeParams {
  userId: string;
  from: string;
  to: string;
}

export interface CreateTimeEntryAdminInput {
  userId: string;
  typeId: string;
  // "YYYY-MM-DDTHH:mm" - a native <input type="datetime-local"> value, interpreted server-side
  // as wall-clock time in the configured business timezone (see timeZoneMath.ts).
  startAt: string;
  endAt?: string;
}

export interface UpdateTimeEntryAdminInput {
  id: string;
  typeId?: string;
  startAt?: string;
  endAt?: string;
}

const buildRangeQuery = ({ userId, from, to }: AdminRangeParams): string =>
  new URLSearchParams({ userId, from, to }).toString();

export const timeAdminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTimeEmployees: builder.query<TimeEmployeeDto[], void>({
      query: () => '/api/time/admin/employees',
      transformResponse: (response: ApiResponse<TimeEmployeeDto[]>) => response.data,
      providesTags: ['TimeEntry'],
    }),
    getTimeEntriesAdmin: builder.query<TimeEntryDto[], AdminRangeParams>({
      query: (params) => `/api/time/admin/entries?${buildRangeQuery(params)}`,
      transformResponse: (response: ApiResponse<TimeEntryDto[]>) => response.data,
      providesTags: ['TimeEntry'],
    }),
    // Powers the "All Employees" review view - every entry across every employee the actor can
    // see, in one call, color-coded client-side per employee rather than per-lock-status.
    getAllTimeEntriesAdmin: builder.query<TimeEntryDto[], TimeRangeParams>({
      query: (params) => `/api/time/admin/entries/all?${new URLSearchParams({ from: params.from, to: params.to }).toString()}`,
      transformResponse: (response: ApiResponse<TimeEntryDto[]>) => response.data,
      providesTags: ['TimeEntry'],
    }),
    getTimeSummaryAdmin: builder.query<TimeEntryTypeTotalDto[], AdminRangeParams>({
      query: (params) => `/api/time/admin/summary?${buildRangeQuery(params)}`,
      transformResponse: (response: ApiResponse<TimeEntryTypeTotalDto[]>) => response.data,
      providesTags: ['TimeEntry'],
    }),
    createTimeEntryAdmin: builder.mutation<TimeEntryDto, CreateTimeEntryAdminInput>({
      query: (body) => ({ url: '/api/time/admin/entries', method: 'POST', body }),
      transformResponse: (response: ApiResponse<TimeEntryDto>) => response.data,
      invalidatesTags: ['TimeEntry', 'TimeAuditLog'],
    }),
    updateTimeEntryAdmin: builder.mutation<TimeEntryDto, UpdateTimeEntryAdminInput>({
      query: ({ id, ...body }) => ({ url: `/api/time/admin/entries/${id}`, method: 'PATCH', body }),
      transformResponse: (response: ApiResponse<TimeEntryDto>) => response.data,
      invalidatesTags: ['TimeEntry', 'TimeAuditLog'],
    }),
    deleteTimeEntryAdmin: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/time/admin/entries/${id}`, method: 'DELETE' }),
      invalidatesTags: ['TimeEntry', 'TimeAuditLog'],
    }),
    lockTimeEntry: builder.mutation<TimeEntryDto, string>({
      query: (id) => ({ url: `/api/time/admin/entries/${id}/lock`, method: 'POST' }),
      transformResponse: (response: ApiResponse<TimeEntryDto>) => response.data,
      invalidatesTags: ['TimeEntry', 'TimeAuditLog'],
    }),
    unlockTimeEntry: builder.mutation<TimeEntryDto, string>({
      query: (id) => ({ url: `/api/time/admin/entries/${id}/unlock`, method: 'POST' }),
      transformResponse: (response: ApiResponse<TimeEntryDto>) => response.data,
      invalidatesTags: ['TimeEntry', 'TimeAuditLog'],
    }),
    getTimeEntryAuditLog: builder.query<TimeAuditLogDto[], string>({
      query: (entryId) => `/api/time/admin/entries/${entryId}/audit`,
      transformResponse: (response: ApiResponse<TimeAuditLogDto[]>) => response.data,
      providesTags: ['TimeAuditLog'],
    }),
  }),
});

export const {
  useGetTimeEmployeesQuery,
  useGetTimeEntriesAdminQuery,
  useGetAllTimeEntriesAdminQuery,
  useGetTimeSummaryAdminQuery,
  useCreateTimeEntryAdminMutation,
  useUpdateTimeEntryAdminMutation,
  useDeleteTimeEntryAdminMutation,
  useLockTimeEntryMutation,
  useUnlockTimeEntryMutation,
  useGetTimeEntryAuditLogQuery,
} = timeAdminApi;
