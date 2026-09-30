import type { ApiResponse } from '@inithium/api-utils';
import type { StaffPhotoSourceType, StaffSearchField } from '@inithium/db';
import { baseApi } from '../baseApi';

// Frontend-facing shape - dates cross the HTTP boundary as ISO strings, mirroring every other
// plugin's own Dto precedent (see GalleryImageDto). firstName/lastName/email are resolved
// server-side from the linked UserEntity (see staff.route.ts's toStaffDto) - staff never stores
// its own copy of them, so every list already arrives display-ready.
export interface StaffMemberDto {
  id: string;
  userId: string;
  title: string;
  bio?: string;
  photoUrl?: string;
  photoSourceType?: StaffPhotoSourceType;
  photoAssetId?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  firstName: string;
  lastName?: string;
  email: string;
}

// Minimal, permission-scoped view of a user eligible to become a staff member - see
// staff.route.ts's /api/staff/user-candidates, which never returns a full AdminUser shape.
export interface StaffUserCandidate {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  role: string;
}

export interface ListPublicStaffParams {
  page: number;
  pageSize: number;
}

export interface ListStaffAdminParams {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: StaffSearchField;
}

export interface ListStaffResult {
  items: StaffMemberDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface StaffWriteInput {
  userId: string;
  title: string;
  bio?: string;
  photoUrl?: string;
  photoSourceType?: StaffPhotoSourceType;
  photoAssetId?: string;
  order?: number;
}

// null clears the photo fields (removing a photo).
export type UpdateStaffInput = { [K in keyof StaffWriteInput]?: StaffWriteInput[K] | null } & { id: string };

const buildListResult = (response: ApiResponse<StaffMemberDto[]>): ListStaffResult => ({
  items: response.data,
  page: (response.meta?.['page'] as number) ?? 1,
  pageSize: (response.meta?.['pageSize'] as number) ?? response.data.length,
  total: (response.meta?.['total'] as number) ?? response.data.length,
  totalPages: (response.meta?.['totalPages'] as number) ?? 1,
});

export const staffApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listPublicStaff: builder.query<ListStaffResult, ListPublicStaffParams>({
      query: ({ page, pageSize }) => `/api/staff?${new URLSearchParams({ page: String(page), pageSize: String(pageSize) })}`,
      transformResponse: buildListResult,
      providesTags: ['Staff'],
    }),
    listStaffAdmin: builder.query<ListStaffResult, ListStaffAdminParams>({
      query: ({ page, pageSize, search, searchField }) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (search) params.set('search', search);
        if (searchField) params.set('searchField', searchField);
        return `/api/staff/admin?${params.toString()}`;
      },
      transformResponse: buildListResult,
      providesTags: ['Staff'],
    }),
    listStaffUserCandidates: builder.query<StaffUserCandidate[], { search?: string }>({
      query: ({ search }) => {
        const query = search ? `?${new URLSearchParams({ search })}` : '';
        return `/api/staff/user-candidates${query}`;
      },
      transformResponse: (response: ApiResponse<StaffUserCandidate[]>) => response.data,
      providesTags: ['Staff'],
    }),
    createStaffMember: builder.mutation<StaffMemberDto, StaffWriteInput>({
      query: (input) => ({ url: '/api/staff', method: 'POST', body: input }),
      transformResponse: (response: ApiResponse<StaffMemberDto>) => response.data,
      invalidatesTags: ['Staff'],
    }),
    updateStaffMember: builder.mutation<StaffMemberDto, UpdateStaffInput>({
      query: ({ id, ...input }) => ({ url: `/api/staff/${id}`, method: 'PUT', body: input }),
      transformResponse: (response: ApiResponse<StaffMemberDto>) => response.data,
      invalidatesTags: ['Staff'],
    }),
    deleteStaffMember: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/staff/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Staff'],
    }),
  }),
});

export const {
  useListPublicStaffQuery,
  useListStaffAdminQuery,
  useListStaffUserCandidatesQuery,
  useCreateStaffMemberMutation,
  useUpdateStaffMemberMutation,
  useDeleteStaffMemberMutation,
} = staffApi;
