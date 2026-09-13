import type { ApiResponse } from '@inithium/api-utils';
import type { AvatarConfig, UserProfileBannerConfig } from '@inithium/db';
import { baseApi } from '../baseApi';

// Purpose-built response shape, not @inithium/db's UserEntity - passwordHash never leaves the
// API, and `email` is only ever present when the requester is viewing their own profile (see
// profile.route.ts's toProfileDto).
export interface ProfileDto {
  id: string;
  firstName: string;
  lastName?: string;
  avatar: AvatarConfig;
  profileBanner?: UserProfileBannerConfig;
  darkMode: boolean;
  createdAt: string;
  email?: string;
}

export interface UpdateMyProfileInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  // Whole-object replacements (the avatar/banner editor dialogs always send a complete config),
  // not per-field patches - matches updateMyProfileSchema's own shape on the API side.
  avatar?: AvatarConfig;
  profileBanner?: UserProfileBannerConfig;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export const profileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProfile: builder.query<ProfileDto, string>({
      query: (id) => `/api/profile/${id}`,
      transformResponse: (response: ApiResponse<ProfileDto>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Profile', id }],
    }),
    updateMyProfile: builder.mutation<ProfileDto, UpdateMyProfileInput>({
      query: (input) => ({ url: '/api/profile/me', method: 'PATCH', body: input }),
      transformResponse: (response: ApiResponse<ProfileDto>) => response.data,
      // Invalidates 'User' too so useGetMeQuery (the Navbar's own name/avatar source) refreshes
      // alongside the profile view itself - the same pair auth.endpoints.ts's login/register
      // already invalidate.
      invalidatesTags: (result) => (result ? ['User', { type: 'Profile', id: result.id }] : ['User']),
    }),
    // Drives the "Change Password" dialog's first step only - never itself authorizes the
    // actual change (see profile.route.ts's /password endpoint, which re-verifies regardless).
    verifyCurrentPassword: builder.mutation<boolean, string>({
      query: (currentPassword) => ({
        url: '/api/profile/me/password/verify',
        method: 'POST',
        body: { currentPassword },
      }),
      transformResponse: (response: ApiResponse<{ valid: boolean }>) => response.data.valid,
    }),
    changePassword: builder.mutation<void, ChangePasswordInput>({
      query: (input) => ({ url: '/api/profile/me/password', method: 'POST', body: input }),
    }),
    // No request body - the server flips the currently-stored value itself (see
    // profile.route.ts), so there's no client-supplied target value that could drift out of
    // sync with it.
    toggleDarkMode: builder.mutation<ProfileDto, void>({
      query: () => ({ url: '/api/profile/me/dark-mode/toggle', method: 'POST' }),
      transformResponse: (response: ApiResponse<ProfileDto>) => response.data,
      invalidatesTags: (result) => (result ? ['User', { type: 'Profile', id: result.id }] : ['User']),
    }),
  }),
});

export const {
  useGetProfileQuery,
  useUpdateMyProfileMutation,
  useVerifyCurrentPasswordMutation,
  useChangePasswordMutation,
  useToggleDarkModeMutation,
} = profileApi;
