export { baseApi } from './baseApi';
export {
  pageApi,
  useGetPageByRouteQuery,
  useGetNavPagesQuery,
  useListPagesQuery,
  useUpdatePageMutation,
} from './endpoints/page.endpoints';
export type { PageSearchField, ListPagesParams, ListPagesResult, UpdatePageInput } from './endpoints/page.endpoints';
export { usePageParams } from './usePageParams';
export { authApi, useGetMeQuery, useLoginMutation, useRegisterMutation } from './endpoints/auth.endpoints';
export type { AuthUser, LoginCredentials, RegisterInput, AuthResponse } from './endpoints/auth.endpoints';
export { ACCESS_TOKEN_STORAGE_KEY, getStoredAccessToken, setStoredAccessToken } from './tokenStorage';

export { presenceApi, useGetUserPresenceQuery } from './endpoints/presence.endpoints';
export { usePresence } from './realtime/usePresence';
export type { UsePresenceOptions } from './realtime/usePresence';
export {
  connectRealtimeClient,
  disconnectRealtimeClient,
  getRealtimeConnectionStatus,
  subscribeToRealtimeStatus,
  subscribeToRealtimeChannel,
  setPresenceStatus,
} from './realtime/realtimeClientStore';
export type { RealtimeConnectionStatus } from './realtime/realtimeClientStore';
export { useRealtimeConnectionStatus } from './realtime/useRealtimeConnectionStatus';
export type { PresenceStatus, PresenceRecord } from '@inithium/realtime';

export {
  notificationsApi,
  useGetNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
} from './endpoints/notifications.endpoints';
export { useNotificationCenter } from './notifications/useNotificationCenter';
export type { UseNotificationCenterOptions, UseNotificationCenterResult } from './notifications/useNotificationCenter';
export type { NotificationEntity } from '@inithium/notifications';

export {
  usersApi,
  useListUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useUpdateUserPermissionsMutation,
  useTransferOwnershipMutation,
  useGetUserRegistrationsOverTimeQuery,
} from './endpoints/users.endpoints';
export type {
  AdminUser,
  UserSearchField,
  ListUsersParams,
  ListUsersResult,
  CreateUserInput,
  UpdateUserInput,
  UpdateUserPermissionsInput,
  UserRegistrationCount,
} from './endpoints/users.endpoints';

export {
  settingsApi,
  useListSettingsQuery,
  useUpsertSettingMutation,
  useGetPublicSettingQuery,
  useAppName,
  useShowPersistentNotificationCenter,
  useIsProfileEnabled,
  useIsDarkModeFeatureEnabled,
  useCustomBrandColors,
  SETTING_TYPES,
} from './endpoints/settings.endpoints';
export type {
  SettingType,
  SettingEntity,
  UpsertSettingInput,
  CustomBrandColorSettings,
} from './endpoints/settings.endpoints';

export {
  profileApi,
  useGetProfileQuery,
  useUpdateMyProfileMutation,
  useVerifyCurrentPasswordMutation,
  useChangePasswordMutation,
  useToggleDarkModeMutation,
} from './endpoints/profile.endpoints';
export type { ProfileDto, UpdateMyProfileInput, ChangePasswordInput } from './endpoints/profile.endpoints';

// inithium:block:gallery:exports:start
export {
  galleryApi,
  useListPublishedGalleryImagesQuery,
  useListGalleryImagesAdminQuery,
  useUploadGalleryImageLocalMutation,
  useCreateGalleryImageMutation,
  useUpdateGalleryImageMutation,
  useDeleteGalleryImageMutation,
} from './endpoints/gallery.endpoints';
export type {
  GalleryImageDto,
  ListPublishedGalleryImagesParams,
  ListGalleryImagesAdminParams,
  ListGalleryImagesResult,
  GalleryImageWriteInput,
  UpdateGalleryImageInput,
  UploadGalleryImageLocalResult,
} from './endpoints/gallery.endpoints';

// inithium:block:gallery:exports:end
// inithium:block:contact:exports:start
export { useIsContactCaptchaEnabled, useContactCaptchaSiteKey } from './endpoints/settings.endpoints';

export {
  contactApi,
  useSubmitContactMutation,
  useAddContactMessageMutation,
  useGetContactInboxQuery,
  useGetMyContactThreadsQuery,
  useGetContactThreadQuery,
  useDeleteContactMutation,
} from './endpoints/contact.endpoints';
export type {
  CommunicationMessageDto,
  CommunicationDto,
  SubmitContactInput,
  AddContactMessageInput,
  ListContactInboxParams,
  ListContactInboxResult,
} from './endpoints/contact.endpoints';

// inithium:block:contact:exports:end
// inithium:block:staff:exports:start
export {
  staffApi,
  useListPublicStaffQuery,
  useListStaffAdminQuery,
  useListStaffUserCandidatesQuery,
  useUploadStaffPhotoLocalMutation,
  useCreateStaffMemberMutation,
  useUpdateStaffMemberMutation,
  useDeleteStaffMemberMutation,
} from './endpoints/staff.endpoints';
export type {
  StaffMemberDto,
  StaffUserCandidate,
  ListPublicStaffParams,
  ListStaffAdminParams,
  ListStaffResult,
  StaffWriteInput,
  UpdateStaffInput,
  UploadStaffPhotoLocalResult,
} from './endpoints/staff.endpoints';

// inithium:block:staff:exports:end
// inithium:block:time:exports:start
export {
  timeClockApi,
  useClockInMutation,
  useClockOutMutation,
  useSwitchTimeEntryTypeMutation,
  useGetMyTimeEntriesQuery,
  useGetMyTimeSummaryQuery,
  useUpdateMyTimeEntryMutation,
  useDeleteMyTimeEntryMutation,
} from './endpoints/time-clock.endpoints';
export type { TimeEntryDto, TimeEntryTypeTotalDto, TimeRangeParams } from './endpoints/time-clock.endpoints';

export {
  timeAdminApi,
  useGetTimeEmployeesQuery,
  useGetTimeEntriesAdminQuery,
  useGetAllTimeEntriesAdminQuery,
  useGetTimeSummaryAdminQuery,
  useCreateTimeEntryAdminMutation,
  useUpdateTimeEntryAdminMutation,
  useDeleteTimeEntryAdminMutation,
  useLockTimeEntryMutation,
  useUnlockTimeEntryMutation,
  useGetTimeEntryAuditLogQuery,
} from './endpoints/time-admin.endpoints';
export type {
  TimeEmployeeDto,
  TimeEntrySnapshotDto,
  TimeAuditLogDto,
  AdminRangeParams,
  CreateTimeEntryAdminInput,
  UpdateTimeEntryAdminInput,
} from './endpoints/time-admin.endpoints';

export {
  timeEntryTypesApi,
  useGetTimeEntryTypesQuery,
  useCreateTimeEntryTypeMutation,
  useUpdateTimeEntryTypeMutation,
  useDeleteTimeEntryTypeMutation,
} from './endpoints/time-entry-types.endpoints';
export type {
  TimeEntryTypeDto,
  CreateTimeEntryTypeInput,
  UpdateTimeEntryTypeInput,
} from './endpoints/time-entry-types.endpoints';

export { timeSettingsApi, useGetTimeSettingsQuery, useUpdateTimeSettingsMutation, useArchiveTimeYearMutation } from './endpoints/time-settings.endpoints';
export type { TimeSettingsDto, UpdateTimeSettingsInput, ArchiveTimeYearResult } from './endpoints/time-settings.endpoints';

// inithium:block:time:exports:end
// inithium:anchor:exports
