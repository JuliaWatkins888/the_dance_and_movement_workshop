import type { ApiResponse } from '@inithium/api-utils';
import type { AcademicYearSearchField, SemesterTerm } from '@inithium/db';
import { baseApi } from '../baseApi';

// A semester as it's embedded in the academic-year/course/class payloads - display-ready, dates as
// ISO strings (they cross the HTTP boundary), mirroring every other plugin's own Dto precedent.
export interface SemesterSummaryDto {
  id: string;
  name: string;
  term: SemesterTerm;
  startDate: string;
  endDate: string;
  registrationOpensAt?: string;
  isPublished: boolean;
}

// startDate/endDate aren't stored on a year - the API derives them as the span of `semesters`
// (absent only for a year with no semesters at all, which creation never produces).
export interface AcademicYearDto {
  id: string;
  title: string;
  description?: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  startDate?: string;
  endDate?: string;
  semesters: SemesterSummaryDto[];
}

export interface ListAcademicYearsAdminParams {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: AcademicYearSearchField;
}

export interface ListAcademicYearsResult {
  items: AcademicYearDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SemesterDatesInput {
  startDate: string;
  endDate: string;
  registrationOpensAt?: string;
}

// Creating a year also stands up its two semesters, so the create payload carries both date ranges.
export interface AcademicYearCreateInput {
  title: string;
  description?: string;
  isPublished?: boolean;
  semesters: Record<SemesterTerm, SemesterDatesInput>;
}

export interface AcademicYearUpdateFields {
  title?: string;
  description?: string;
  isPublished?: boolean;
}

export type UpdateAcademicYearInput = AcademicYearUpdateFields & { id: string };

const buildListResult = (response: ApiResponse<AcademicYearDto[]>): ListAcademicYearsResult => ({
  items: response.data,
  page: (response.meta?.['page'] as number) ?? 1,
  pageSize: (response.meta?.['pageSize'] as number) ?? response.data.length,
  total: (response.meta?.['total'] as number) ?? response.data.length,
  totalPages: (response.meta?.['totalPages'] as number) ?? 1,
});

// Creating/deleting a year creates/deletes its semesters, and a semester's dates feed the year's
// derived span, so the two tag types invalidate together.
export const academicYearsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Unpaged and public - the browse page's "which year?" dropdown. The server already limits it
    // to published years that are in session or still to come.
    listPublicAcademicYears: builder.query<AcademicYearDto[], void>({
      query: () => '/api/academic-years',
      transformResponse: (response: ApiResponse<AcademicYearDto[]>) => response.data,
      providesTags: ['AcademicYear', 'Semester'],
    }),
    listAcademicYearsAdmin: builder.query<ListAcademicYearsResult, ListAcademicYearsAdminParams>({
      query: ({ page, pageSize, search, searchField }) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (search) params.set('search', search);
        if (searchField) params.set('searchField', searchField);
        return `/api/academic-years/admin?${params.toString()}`;
      },
      transformResponse: buildListResult,
      providesTags: ['AcademicYear', 'Semester'],
    }),
    createAcademicYear: builder.mutation<AcademicYearDto, AcademicYearCreateInput>({
      query: (input) => ({ url: '/api/academic-years', method: 'POST', body: input }),
      transformResponse: (response: ApiResponse<AcademicYearDto>) => response.data,
      invalidatesTags: ['AcademicYear', 'Semester'],
    }),
    updateAcademicYear: builder.mutation<AcademicYearDto, UpdateAcademicYearInput>({
      query: ({ id, ...input }) => ({ url: `/api/academic-years/${id}`, method: 'PUT', body: input }),
      transformResponse: (response: ApiResponse<AcademicYearDto>) => response.data,
      invalidatesTags: ['AcademicYear', 'Semester', 'Course', 'Class', 'Workshop'],
    }),
    deleteAcademicYear: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/academic-years/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AcademicYear', 'Semester'],
    }),
  }),
});

export const {
  useListPublicAcademicYearsQuery,
  useListAcademicYearsAdminQuery,
  useCreateAcademicYearMutation,
  useUpdateAcademicYearMutation,
  useDeleteAcademicYearMutation,
} = academicYearsApi;
