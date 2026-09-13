import type { ApiResponse } from '@inithium/api-utils';
import { baseApi } from '../baseApi';

export interface TimeEntryTypeDto {
  id: string;
  label: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTimeEntryTypeInput {
  label: string;
  order?: number;
}

export type UpdateTimeEntryTypeInput = Partial<CreateTimeEntryTypeInput> & { id: string };

export const timeEntryTypesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTimeEntryTypes: builder.query<TimeEntryTypeDto[], void>({
      query: () => '/api/time/entry-types',
      transformResponse: (response: ApiResponse<TimeEntryTypeDto[]>) => response.data,
      providesTags: ['TimeEntryType'],
    }),
    createTimeEntryType: builder.mutation<TimeEntryTypeDto, CreateTimeEntryTypeInput>({
      query: (body) => ({ url: '/api/time/entry-types', method: 'POST', body }),
      transformResponse: (response: ApiResponse<TimeEntryTypeDto>) => response.data,
      invalidatesTags: ['TimeEntryType'],
    }),
    updateTimeEntryType: builder.mutation<TimeEntryTypeDto, UpdateTimeEntryTypeInput>({
      query: ({ id, ...body }) => ({ url: `/api/time/entry-types/${id}`, method: 'PATCH', body }),
      transformResponse: (response: ApiResponse<TimeEntryTypeDto>) => response.data,
      invalidatesTags: ['TimeEntryType'],
    }),
    deleteTimeEntryType: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/time/entry-types/${id}`, method: 'DELETE' }),
      invalidatesTags: ['TimeEntryType'],
    }),
  }),
});

export const {
  useGetTimeEntryTypesQuery,
  useCreateTimeEntryTypeMutation,
  useUpdateTimeEntryTypeMutation,
  useDeleteTimeEntryTypeMutation,
} = timeEntryTypesApi;
