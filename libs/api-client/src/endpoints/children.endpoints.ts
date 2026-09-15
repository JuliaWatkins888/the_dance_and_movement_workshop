import type { ApiResponse } from '@inithium/api-utils';
import type { ChildGender, ChildRegistrationEntry, ChildSearchField } from '@inithium/db';
import { baseApi } from '../baseApi';

// Frontend-facing shape - dates cross the HTTP boundary as ISO strings, mirroring every other
// plugin's own Dto precedent (see StaffMemberDto). parentFirstName/parentLastName/parentEmail are
// resolved server-side from the linked UserEntity (see children.route.ts's toChildDto) - a child
// never stores its own copy of them.
export interface ChildDto {
  id: string;
  parentUserId: string;
  firstName: string;
  lastName?: string;
  age: number;
  gender: ChildGender;
  activeRegistrations: ChildRegistrationEntry[];
  createdAt: string;
  updatedAt: string;
  parentFirstName: string;
  parentLastName?: string;
  parentEmail: string;
}

// Minimal, permission-scoped view of a user eligible to be linked as a child's parent - see
// children.route.ts's /api/children/parent-candidates, which never returns a full AdminUser
// shape. Shaped identically to StaffUserCandidate, kept as its own type since the two endpoints
// are independent (parents aren't staff-eligible-role-filtered the way staff candidates are).
export interface ChildParentCandidate {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  role: string;
}

export interface ListChildrenAdminParams {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: ChildSearchField;
}

export interface ListChildrenResult {
  items: ChildDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ChildWriteInput {
  parentUserId?: string;
  firstName: string;
  lastName?: string;
  age: number;
  gender: ChildGender;
}

export type UpdateChildInput = Partial<ChildWriteInput> & { id: string };

export interface ChildAccountCount {
  date: string;
  count: number;
}

const buildListResult = (response: ApiResponse<ChildDto[]>): ListChildrenResult => ({
  items: response.data,
  page: (response.meta?.['page'] as number) ?? 1,
  pageSize: (response.meta?.['pageSize'] as number) ?? response.data.length,
  total: (response.meta?.['total'] as number) ?? response.data.length,
  totalPages: (response.meta?.['totalPages'] as number) ?? 1,
});

export const childrenApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listMyChildren: builder.query<ChildDto[], void>({
      query: () => '/api/children/mine',
      transformResponse: (response: ApiResponse<ChildDto[]>) => response.data,
      providesTags: ['Child'],
    }),
    listChildrenAdmin: builder.query<ListChildrenResult, ListChildrenAdminParams>({
      query: ({ page, pageSize, search, searchField }) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (search) params.set('search', search);
        if (searchField) params.set('searchField', searchField);
        return `/api/children/admin?${params.toString()}`;
      },
      transformResponse: buildListResult,
      providesTags: ['Child'],
    }),
    listChildParentCandidates: builder.query<ChildParentCandidate[], { search?: string }>({
      query: ({ search }) => {
        const query = search ? `?${new URLSearchParams({ search })}` : '';
        return `/api/children/parent-candidates${query}`;
      },
      transformResponse: (response: ApiResponse<ChildParentCandidate[]>) => response.data,
      providesTags: ['Child'],
    }),
    getChild: builder.query<ChildDto, string>({
      query: (id) => `/api/children/${id}`,
      transformResponse: (response: ApiResponse<ChildDto>) => response.data,
      providesTags: ['Child'],
    }),
    createChild: builder.mutation<ChildDto, ChildWriteInput>({
      query: (input) => ({ url: '/api/children', method: 'POST', body: input }),
      transformResponse: (response: ApiResponse<ChildDto>) => response.data,
      invalidatesTags: ['Child'],
    }),
    updateChild: builder.mutation<ChildDto, UpdateChildInput>({
      query: ({ id, ...input }) => ({ url: `/api/children/${id}`, method: 'PUT', body: input }),
      transformResponse: (response: ApiResponse<ChildDto>) => response.data,
      invalidatesTags: ['Child'],
    }),
    deleteChild: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/children/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Child'],
    }),
    getChildrenCreatedOverTime: builder.query<ChildAccountCount[], void>({
      query: () => '/api/children/stats/created',
      transformResponse: (response: ApiResponse<ChildAccountCount[]>) => response.data,
      providesTags: ['Child'],
    }),
  }),
});

export const {
  useListMyChildrenQuery,
  useListChildrenAdminQuery,
  useListChildParentCandidatesQuery,
  useGetChildQuery,
  useCreateChildMutation,
  useUpdateChildMutation,
  useDeleteChildMutation,
  useGetChildrenCreatedOverTimeQuery,
} = childrenApi;
