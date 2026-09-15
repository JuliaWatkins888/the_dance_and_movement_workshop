import type { ApiResponse } from '@inithium/api-utils';
import type { ClassSearchField, DayOfWeek } from '@inithium/db';
import { baseApi } from '../baseApi';

// Frontend-facing shape - dates cross the HTTP boundary as ISO strings, mirroring every other
// plugin's own Dto precedent (see StaffMemberDto/PolicyCategoryDto). `openings` is computed
// server-side (classes.route.ts's toClassDto) from capacity/enrolled so every consumer reads the
// same derived value rather than re-deriving it.
export interface ClassDto {
  id: string;
  name: string;
  description?: string;
  categories: string[];
  instructors: string[];
  daysOfWeek: DayOfWeek[];
  startTime: string;
  endTime: string;
  session: string;
  registrationStartDate?: string;
  startDate: string;
  endDate: string;
  minAgeYears?: number;
  maxAgeYears?: number;
  priceAmount: number;
  billingCycle: string;
  capacity: number;
  enrolled: number;
  openings: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListClassesAdminParams {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: ClassSearchField;
}

export interface ListClassesResult {
  items: ClassDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ClassWriteInput {
  name: string;
  description?: string;
  categories: string[];
  instructors: string[];
  daysOfWeek: DayOfWeek[];
  startTime: string;
  endTime: string;
  session: string;
  registrationStartDate?: string;
  startDate: string;
  endDate: string;
  minAgeYears?: number;
  maxAgeYears?: number;
  priceAmount: number;
  billingCycle: string;
  capacity: number;
  enrolled?: number;
  isPublished?: boolean;
}

export type UpdateClassInput = Partial<ClassWriteInput> & { id: string };

const buildListResult = (response: ApiResponse<ClassDto[]>): ListClassesResult => ({
  items: response.data,
  page: (response.meta?.['page'] as number) ?? 1,
  pageSize: (response.meta?.['pageSize'] as number) ?? response.data.length,
  total: (response.meta?.['total'] as number) ?? response.data.length,
  totalPages: (response.meta?.['totalPages'] as number) ?? 1,
});

export const classesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Unpaged - the public ClassesPage fetches the whole published catalog once and does
    // search/filter/pagination client-side, mirroring policiesApi.listPolicies.
    listPublicClasses: builder.query<ClassDto[], void>({
      query: () => '/api/classes',
      transformResponse: (response: ApiResponse<ClassDto[]>) => response.data,
      providesTags: ['Class'],
    }),
    listClassesAdmin: builder.query<ListClassesResult, ListClassesAdminParams>({
      query: ({ page, pageSize, search, searchField }) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (search) params.set('search', search);
        if (searchField) params.set('searchField', searchField);
        return `/api/classes/admin?${params.toString()}`;
      },
      transformResponse: buildListResult,
      providesTags: ['Class'],
    }),
    createClass: builder.mutation<ClassDto, ClassWriteInput>({
      query: (input) => ({ url: '/api/classes', method: 'POST', body: input }),
      transformResponse: (response: ApiResponse<ClassDto>) => response.data,
      invalidatesTags: ['Class'],
    }),
    updateClass: builder.mutation<ClassDto, UpdateClassInput>({
      query: ({ id, ...input }) => ({ url: `/api/classes/${id}`, method: 'PUT', body: input }),
      transformResponse: (response: ApiResponse<ClassDto>) => response.data,
      invalidatesTags: ['Class'],
    }),
    deleteClass: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/classes/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Class'],
    }),
  }),
});

export const {
  useListPublicClassesQuery,
  useListClassesAdminQuery,
  useCreateClassMutation,
  useUpdateClassMutation,
  useDeleteClassMutation,
} = classesApi;
