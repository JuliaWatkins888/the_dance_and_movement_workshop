import type { AvatarConfig } from '@inithium/db';
import { baseApi } from '../baseApi';

// Purpose-built response shape rather than reusing `@inithium/db`'s UserEntity — the API never
// returns `passwordHash`, so reusing that type here would claim a field that can't actually
// be present.
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  role: string;
  isOwner: boolean;
  // Resolved server-side (role default bundle + overrides) - see auth.route.ts's toAuthUser.
  // Never re-derived client-side so the merge logic stays single-sourced.
  capabilities: string[];
  avatar: AvatarConfig;
  darkMode: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

// /auth/* responses are the core API's legacy raw-JSON shape ({user, accessToken} / {user}),
// not the {success, data} envelope `createSuccessResponse` wraps the newer Pages routes in —
// no transformResponse unwrap needed here, unlike page.endpoints.ts.
export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMe: builder.query<AuthUser, void>({
      query: () => '/auth/me',
      transformResponse: (response: { user: AuthUser }) => response.user,
      providesTags: ['User'],
    }),
    login: builder.mutation<AuthResponse, LoginCredentials>({
      query: (credentials) => ({ url: '/auth/login', method: 'POST', body: credentials }),
      invalidatesTags: ['User'],
    }),
    register: builder.mutation<AuthResponse, RegisterInput>({
      query: (input) => ({ url: '/auth/register', method: 'POST', body: input }),
      invalidatesTags: ['User'],
    }),
  }),
});

export const { useGetMeQuery, useLoginMutation, useRegisterMutation } = authApi;
