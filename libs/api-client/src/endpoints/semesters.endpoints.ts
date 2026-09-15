import type { ApiResponse } from '@inithium/api-utils';
import type { SemesterSearchField } from '@inithium/db';
import { baseApi } from '../baseApi';

// Frontend-facing shape - dates cross the HTTP boundary as ISO strings, mirroring every other
// plugin's own Dto precedent (see ClassDto). Semester has no public tier, so there's only ever
// one list query here, unlike classesApi/coursesApi's public+admin pair.
export interface SemesterDto {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  registrationOpensAt?: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListSemestersAdminParams {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: SemesterSearchField;
}

export interface ListSemestersResult {
  items: SemesterDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SemesterWriteInput {
  name: string;
  startDate: string;
  endDate: string;
  registrationOpensAt?: string;
  isPublished?: boolean;
}

export type UpdateSemesterInput = Partial<SemesterWriteInput> & { id: string };

const buildListResult = (response: ApiResponse<SemesterDto[]>): ListSemestersResult => ({
  items: response.data,
  page: (response.meta?.['page'] as number) ?? 1,
  pageSize: (response.meta?.['pageSize'] as number) ?? response.data.length,
  total: (response.meta?.['total'] as number) ?? response.data.length,
  totalPages: (response.meta?.['totalPages'] as number) ?? 1,
});

export const semestersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listSemestersAdmin: builder.query<ListSemestersResult, ListSemestersAdminParams>({
      query: ({ page, pageSize, search, searchField }) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (search) params.set('search', search);
        if (searchField) params.set('searchField', searchField);
        return `/api/semesters?${params.toString()}`;
      },
      transformResponse: buildListResult,
      providesTags: ['Semester'],
    }),
    createSemester: builder.mutation<SemesterDto, SemesterWriteInput>({
      query: (input) => ({ url: '/api/semesters', method: 'POST', body: input }),
      transformResponse: (response: ApiResponse<SemesterDto>) => response.data,
      invalidatesTags: ['Semester'],
    }),
    updateSemester: builder.mutation<SemesterDto, UpdateSemesterInput>({
      query: ({ id, ...input }) => ({ url: `/api/semesters/${id}`, method: 'PUT', body: input }),
      transformResponse: (response: ApiResponse<SemesterDto>) => response.data,
      invalidatesTags: ['Semester'],
    }),
    deleteSemester: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/semesters/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Semester'],
    }),
  }),
});

export const { useListSemestersAdminQuery, useCreateSemesterMutation, useUpdateSemesterMutation, useDeleteSemesterMutation } = semestersApi;
