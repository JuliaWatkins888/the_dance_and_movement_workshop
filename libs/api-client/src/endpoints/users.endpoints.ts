import type { ApiResponse } from '@inithium/api-utils';
import type { AvatarConfig } from '@inithium/db';
import { baseApi } from '../baseApi';

// Purpose-built response shape, not @inithium/db's UserEntity - the API never returns
// passwordHash, matching AuthUser's existing precedent in auth.endpoints.ts.
export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  role: string;
  isOwner: boolean;
  // Raw per-user overrides, not resolved against role defaults - the Permissions module's edit
  // dialog needs to distinguish an explicit override from a role default, unlike AuthUser's
  // already-resolved `capabilities` (see auth.endpoints.ts).
  capabilityOverrides: Record<string, boolean>;
  avatar: AvatarConfig;
  darkMode: boolean;
  createdAt: string;
}

export type UserSearchField = 'firstName' | 'lastName' | 'email';

export interface ListUsersParams {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: UserSearchField;
}

export interface ListUsersResult {
  items: AdminUser[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  role?: string;
}

export interface UpdateUserInput {
  id: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

export interface UpdateUserPermissionsInput {
  id: string;
  capabilityOverrides: Record<string, boolean>;
}

export interface UserRegistrationCount {
  date: string;
  count: number;
}

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listUsers: builder.query<ListUsersResult, ListUsersParams>({
      query: ({ page, pageSize, search, searchField }) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (search) params.set('search', search);
        if (searchField) params.set('searchField', searchField);
        return `/api/users?${params.toString()}`;
      },
      transformResponse: (response: ApiResponse<AdminUser[]>): ListUsersResult => ({
        items: response.data,
        page: (response.meta?.['page'] as number) ?? 1,
        pageSize: (response.meta?.['pageSize'] as number) ?? response.data.length,
        total: (response.meta?.['total'] as number) ?? response.data.length,
        totalPages: (response.meta?.['totalPages'] as number) ?? 1,
      }),
      providesTags: ['User'],
    }),
    createUser: builder.mutation<AdminUser, CreateUserInput>({
      query: (input) => ({ url: '/api/users', method: 'POST', body: input }),
      transformResponse: (response: ApiResponse<AdminUser>) => response.data,
      invalidatesTags: ['User'],
    }),
    updateUser: builder.mutation<AdminUser, UpdateUserInput>({
      query: ({ id, ...input }) => ({ url: `/api/users/${id}`, method: 'PATCH', body: input }),
      transformResponse: (response: ApiResponse<AdminUser>) => response.data,
      invalidatesTags: ['User'],
    }),
    deleteUser: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/users/${id}`, method: 'DELETE' }),
      invalidatesTags: ['User'],
    }),
    updateUserPermissions: builder.mutation<AdminUser, UpdateUserPermissionsInput>({
      query: ({ id, capabilityOverrides }) => ({
        url: `/api/users/${id}/permissions`,
        method: 'PATCH',
        body: { capabilityOverrides },
      }),
      transformResponse: (response: ApiResponse<AdminUser>) => response.data,
      invalidatesTags: ['User'],
    }),
    transferOwnership: builder.mutation<AdminUser, string>({
      query: (id) => ({ url: `/api/users/${id}/transfer-ownership`, method: 'POST' }),
      transformResponse: (response: ApiResponse<AdminUser>) => response.data,
      invalidatesTags: ['User'],
    }),
    getUserRegistrationsOverTime: builder.query<UserRegistrationCount[], void>({
      query: () => '/api/users/stats/registrations',
      transformResponse: (response: ApiResponse<UserRegistrationCount[]>) => response.data,
      providesTags: ['User'],
    }),
  }),
});

export const {
  useListUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useUpdateUserPermissionsMutation,
  useTransferOwnershipMutation,
  useGetUserRegistrationsOverTimeQuery,
} = usersApi;
