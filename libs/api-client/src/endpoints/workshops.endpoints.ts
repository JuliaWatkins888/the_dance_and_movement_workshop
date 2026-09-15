import type { ApiResponse } from '@inithium/api-utils';
import type { WorkshopSearchField } from '@inithium/db';
import { baseApi } from '../baseApi';

// Resolved server-side (workshops.route.ts's toWorkshopDto) from instructorIds via Staff -> User -
// arrives display-ready, the same precedent StaffMemberDto's firstName/lastName already follows.
export interface WorkshopInstructorSummary {
  id: string;
  name: string;
  photoUrl?: string;
}

export interface WorkshopOccurrenceDto {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

// Frontend-facing shape - dates cross the HTTP boundary as ISO strings. `openings` is computed
// server-side from capacity/enrolled, mirroring ClassDto's own precedent.
export interface WorkshopDto {
  id: string;
  semesterId: string;
  name: string;
  description?: string;
  instructorIds: string[];
  occurrences: WorkshopOccurrenceDto[];
  minAgeYears?: number;
  maxAgeYears?: number;
  priceAmount: number;
  registrationStartDate?: string;
  capacity: number;
  enrolled: number;
  openings: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  semesterName: string;
  instructors: WorkshopInstructorSummary[];
}

export interface ListWorkshopsAdminParams {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: WorkshopSearchField;
  semesterId?: string;
}

export interface ListWorkshopsResult {
  items: WorkshopDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface WorkshopOccurrenceWriteInput {
  date: string;
  startTime: string;
  endTime: string;
}

export interface WorkshopWriteInput {
  semesterId: string;
  name: string;
  description?: string;
  instructorIds: string[];
  occurrences: WorkshopOccurrenceWriteInput[];
  minAgeYears?: number;
  maxAgeYears?: number;
  priceAmount: number;
  registrationStartDate?: string;
  capacity: number;
  enrolled?: number;
  isPublished?: boolean;
}

export type UpdateWorkshopInput = Partial<WorkshopWriteInput> & { id: string };

const buildListResult = (response: ApiResponse<WorkshopDto[]>): ListWorkshopsResult => ({
  items: response.data,
  page: (response.meta?.['page'] as number) ?? 1,
  pageSize: (response.meta?.['pageSize'] as number) ?? response.data.length,
  total: (response.meta?.['total'] as number) ?? response.data.length,
  totalPages: (response.meta?.['totalPages'] as number) ?? 1,
});

export const workshopsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Unpaged - the public WorkshopsPage fetches the whole published catalog once (already sorted
    // by earliest occurrence date server-side) and filters it client-side, mirroring
    // classesApi.listPublicClasses.
    listPublicWorkshops: builder.query<WorkshopDto[], void>({
      query: () => '/api/workshops',
      transformResponse: (response: ApiResponse<WorkshopDto[]>) => response.data,
      providesTags: ['Workshop'],
    }),
    listWorkshopsAdmin: builder.query<ListWorkshopsResult, ListWorkshopsAdminParams>({
      query: ({ page, pageSize, search, searchField, semesterId }) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (search) params.set('search', search);
        if (searchField) params.set('searchField', searchField);
        if (semesterId) params.set('semesterId', semesterId);
        return `/api/workshops/admin?${params.toString()}`;
      },
      transformResponse: buildListResult,
      providesTags: ['Workshop'],
    }),
    createWorkshop: builder.mutation<WorkshopDto, WorkshopWriteInput>({
      query: (input) => ({ url: '/api/workshops', method: 'POST', body: input }),
      transformResponse: (response: ApiResponse<WorkshopDto>) => response.data,
      invalidatesTags: ['Workshop'],
    }),
    updateWorkshop: builder.mutation<WorkshopDto, UpdateWorkshopInput>({
      query: ({ id, ...input }) => ({ url: `/api/workshops/${id}`, method: 'PUT', body: input }),
      transformResponse: (response: ApiResponse<WorkshopDto>) => response.data,
      invalidatesTags: ['Workshop'],
    }),
    deleteWorkshop: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/workshops/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Workshop'],
    }),
  }),
});

export const {
  useListPublicWorkshopsQuery,
  useListWorkshopsAdminQuery,
  useCreateWorkshopMutation,
  useUpdateWorkshopMutation,
  useDeleteWorkshopMutation,
} = workshopsApi;
