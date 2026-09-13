import type { ApiResponse } from '@inithium/api-utils';
import { baseApi } from '../baseApi';

export interface TimeSettingsDto {
  timezone: string;
  autoClockoutThresholdMinutes: number;
  updatedAt: string;
}

export type UpdateTimeSettingsInput = Partial<Pick<TimeSettingsDto, 'timezone' | 'autoClockoutThresholdMinutes'>>;

export interface ArchiveTimeYearResult {
  deletedCount: number;
}

export const timeSettingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTimeSettings: builder.query<TimeSettingsDto, void>({
      query: () => '/api/time/settings',
      transformResponse: (response: ApiResponse<TimeSettingsDto>) => response.data,
      providesTags: ['TimeSettings'],
    }),
    updateTimeSettings: builder.mutation<TimeSettingsDto, UpdateTimeSettingsInput>({
      query: (body) => ({ url: '/api/time/settings', method: 'PATCH', body }),
      transformResponse: (response: ApiResponse<TimeSettingsDto>) => response.data,
      invalidatesTags: ['TimeSettings'],
    }),
    archiveTimeYear: builder.mutation<ArchiveTimeYearResult, { year: number }>({
      query: (body) => ({ url: '/api/time/admin/archive-year', method: 'POST', body }),
      transformResponse: (response: ApiResponse<ArchiveTimeYearResult>) => response.data,
      invalidatesTags: ['TimeEntry', 'TimeAuditLog'],
    }),
  }),
});

export const { useGetTimeSettingsQuery, useUpdateTimeSettingsMutation, useArchiveTimeYearMutation } = timeSettingsApi;
