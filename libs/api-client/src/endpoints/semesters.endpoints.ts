import type { ApiResponse } from '@inithium/api-utils';
import type { SemesterSearchField, SemesterTerm } from '@inithium/db';
import { baseApi } from '../baseApi';

// Frontend-facing shape - dates cross the HTTP boundary as ISO strings, mirroring every other
// plugin's own Dto precedent (see ClassDto). Semester has no public tier (a visitor only sees one
// embedded in an academic year, course or class payload), so there's only ever one list query here,
// and no create/delete - semesters are stood up and removed with their academic year.
export interface SemesterDto {
  id: string;
  academicYearId: string;
  term: SemesterTerm;
  name: string;
  startDate: string;
  endDate: string;
  registrationOpensAt?: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  // Resolved server-side (semesters.route.ts's toSemesterDto) from the parent year.
  academicYearTitle: string;
}

export interface ListSemestersAdminParams {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: SemesterSearchField;
  academicYearId?: string;
}

export interface ListSemestersResult {
  items: SemesterDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// A semester's parent year and term slot are fixed at creation, so they're not editable here.
export interface SemesterWriteInput {
  name?: string;
  startDate?: string;
  endDate?: string;
  registrationOpensAt?: string;
  isPublished?: boolean;
}

export type UpdateSemesterInput = SemesterWriteInput & { id: string };

const buildListResult = (response: ApiResponse<SemesterDto[]>): ListSemestersResult => ({
  items: response.data,
  page: (response.meta?.['page'] as number) ?? 1,
  pageSize: (response.meta?.['pageSize'] as number) ?? response.data.length,
  total: (response.meta?.['total'] as number) ?? response.data.length,
  totalPages: (response.meta?.['totalPages'] as number) ?? 1,
});

// Semester dates feed the derived span/registration state of everything that embeds them, so an
// edit invalidates the year, course, class and workshop caches too.
export const semestersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listSemestersAdmin: builder.query<ListSemestersResult, ListSemestersAdminParams>({
      query: ({ page, pageSize, search, searchField, academicYearId }) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (search) params.set('search', search);
        if (searchField) params.set('searchField', searchField);
        if (academicYearId) params.set('academicYearId', academicYearId);
        return `/api/semesters?${params.toString()}`;
      },
      transformResponse: buildListResult,
      providesTags: ['Semester'],
    }),
    updateSemester: builder.mutation<SemesterDto, UpdateSemesterInput>({
      query: ({ id, ...input }) => ({ url: `/api/semesters/${id}`, method: 'PUT', body: input }),
      transformResponse: (response: ApiResponse<SemesterDto>) => response.data,
      invalidatesTags: ['Semester', 'AcademicYear', 'Course', 'Class', 'Workshop'],
    }),
  }),
});

export const { useListSemestersAdminQuery, useUpdateSemesterMutation } = semestersApi;
