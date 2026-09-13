import type { ApiResponse } from '@inithium/api-utils';
import type { NotificationEntity } from '@inithium/notifications';
import { baseApi } from '../baseApi';

// Both queries take `void` args - the server scopes to "me" via the auth token, the same as
// getMe (`/auth/me`), not via an `:id` in the URL - so there's nothing to pass through.
export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<NotificationEntity[], void>({
      query: () => '/api/notifications',
      transformResponse: (response: ApiResponse<NotificationEntity[]>) => response.data,
      providesTags: ['Notification'],
    }),
    getUnreadNotificationCount: builder.query<{ count: number }, void>({
      query: () => '/api/notifications/unread-count',
      transformResponse: (response: ApiResponse<{ count: number }>) => response.data,
      providesTags: ['Notification'],
    }),
    markNotificationRead: builder.mutation<NotificationEntity, string>({
      query: (id) => ({ url: `/api/notifications/${id}/read`, method: 'PATCH' }),
      transformResponse: (response: ApiResponse<NotificationEntity>) => response.data,
      invalidatesTags: ['Notification'],
    }),
    markAllNotificationsRead: builder.mutation<{ count: number }, void>({
      query: () => ({ url: '/api/notifications/read-all', method: 'PATCH' }),
      transformResponse: (response: ApiResponse<{ count: number }>) => response.data,
      invalidatesTags: ['Notification'],
    }),
    deleteNotification: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/notifications/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Notification'],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
} = notificationsApi;
