import { DbProvider, DbConfig } from './contracts/db-provider.contract';
import { CreatePageInput, FindManyPagesOptions, NavLocation, UpdatePageInput } from './contracts/page.contract';
import { CreateUserInput, FindManyUsersOptions, UpdateUserInput } from './contracts/user.contract';
import { UpsertSettingInput } from './contracts/settings.contract';
// inithium:block:gallery:imports:start
import {
  CreateGalleryImageInput,
  FindManyGalleryImagesOptions,
  FindPublishedGalleryImagesOptions,
  UpdateGalleryImageInput,
} from './contracts/gallery-image.contract';
// inithium:block:gallery:imports:end
// inithium:block:contact:imports:start
import { AddCommunicationMessageInput, CreateCommunicationInput, FindManyCommunicationsOptions } from './contracts/communication.contract';
// inithium:block:contact:imports:end
// inithium:block:staff:imports:start
import {
  CreateStaffInput,
  FindManyStaffOptions,
  UpdateStaffInput,
} from './contracts/staff.contract';
// inithium:block:staff:imports:end
// inithium:block:time:imports:start
import {
  CreateTimeEntryInput,
  FindEntriesForUsersInRangeOptions,
  FindEntriesInRangeOptions,
  UpdateTimeEntryInput,
} from './contracts/time-entry.contract';
import { CreateTimeEntryTypeInput, UpdateTimeEntryTypeInput } from './contracts/time-entry-type.contract';
import { UpdateTimeSettingsInput } from './contracts/time-settings.contract';
import { CreateTimeAuditLogInput } from './contracts/time-audit-log.contract';
// inithium:block:time:imports:end
// inithium:block:policy:imports:start
import {
  CreatePolicyCategoryInput,
  CreatePolicyItemInput,
  UpdatePolicyCategoryInput,
  UpdatePolicyItemInput,
} from './contracts/policy.contract';
// inithium:block:policy:imports:end
// inithium:block:classes:imports:start
import { CreateClassInput, FindManyClassesOptions, UpdateClassInput } from './contracts/class.contract';
// inithium:block:classes:imports:end
// inithium:block:children:imports:start
import { CreateChildInput, FindManyChildrenOptions, UpdateChildInput } from './contracts/child.contract';
// inithium:block:children:imports:end
// inithium:anchor:imports
import { activeProvider as defaultProvider } from './providers/active-provider';

let activeProvider: DbProvider = defaultProvider;

export const setDbProvider = (provider: DbProvider): void => {
  activeProvider = provider;
};

export const getDbProvider = (): DbProvider => activeProvider;

export const connectDatabase = async (config: DbConfig): Promise<void> => {
  await activeProvider.connect(config);
  console.log(`Successfully connected using [${activeProvider.name}] Database Provider`);
};

export const disconnectDatabase = async (): Promise<void> => {
  await activeProvider.disconnect();
};

export const getUserRepository = () => activeProvider.getUserRepository();
export const listUsers = (options: FindManyUsersOptions) => getUserRepository().findMany(options);
export const createUser = (input: CreateUserInput) => getUserRepository().create(input);
export const updateUser = (id: string, input: UpdateUserInput) => getUserRepository().update(id, input);
export const deleteUser = (id: string) => getUserRepository().delete(id);
export const getUserRegistrationsByDay = () => getUserRepository().countRegistrationsByDay();
export const countAllUsers = () => getUserRepository().countAll();
export const transferOwnership = (newOwnerId: string) => getUserRepository().transferOwnership(newOwnerId);

export const getPageRepository = () => activeProvider.getPageRepository();
export const findPageByRoutePattern = (routePattern: string) =>
  getPageRepository().findByRoutePattern(routePattern);
export const findPageBySlug = (slug: string) => getPageRepository().findBySlug(slug);
export const findPagesByNavLocation = (location: NavLocation) =>
  getPageRepository().findByNavLocation(location);
export const findPublishedPages = () => getPageRepository().findPublished();
export const findPluginPages = () => getPageRepository().findPluginPages();
export const listPages = (options: FindManyPagesOptions) => getPageRepository().findMany(options);
export const createPage = (input: CreatePageInput) => getPageRepository().create(input);
export const updatePage = (id: string, input: UpdatePageInput) => getPageRepository().update(id, input);
export const deletePage = (id: string) => getPageRepository().delete(id);

export const getNotificationRepository = () => activeProvider.getNotificationRepository();
export const listNotificationsForUser = (userId: string, options?: { limit?: number }) =>
  getNotificationRepository().listForUser(userId, options);
export const countUnreadNotificationsForUser = (userId: string) =>
  getNotificationRepository().countUnreadForUser(userId);
export const markNotificationAsRead = (id: string, userId: string) =>
  getNotificationRepository().markAsRead(id, userId);
export const markAllNotificationsAsReadForUser = (userId: string) =>
  getNotificationRepository().markAllAsReadForUser(userId);
export const deleteNotificationForUser = (id: string, userId: string) =>
  getNotificationRepository().deleteForUser(id, userId);
export const deleteNotificationsByActionUrls = (actionUrls: string[]) =>
  getNotificationRepository().deleteByActionUrls(actionUrls);

export const getSettingsRepository = () => activeProvider.getSettingRepository();
export const listSettings = () => getSettingsRepository().findAll();
// Returns null when nothing has been saved for this key yet - callers fall back to their own
// default, the same merge logic the CMS Settings module itself uses against its definitions.
export const getSetting = (key: string) => getSettingsRepository().findByKey(key);
export const upsertSetting = (input: UpsertSettingInput) => getSettingsRepository().upsert(input);

// inithium:block:gallery:repositories:start
export const getGalleryRepository = () => activeProvider.getGalleryRepository();
export const listGalleryImages = (options: FindManyGalleryImagesOptions) => getGalleryRepository().findMany(options);
export const listPublishedGalleryImages = (options: FindPublishedGalleryImagesOptions) =>
  getGalleryRepository().findPublished(options);
export const getGalleryImageById = (id: string) => getGalleryRepository().findById(id);
export const createGalleryImage = (input: CreateGalleryImageInput) => getGalleryRepository().create(input);
export const updateGalleryImage = (id: string, input: UpdateGalleryImageInput) =>
  getGalleryRepository().update(id, input);
export const deleteGalleryImage = (id: string) => getGalleryRepository().delete(id);

// inithium:block:gallery:repositories:end
// inithium:block:contact:repositories:start
export const getCommunicationRepository = () => activeProvider.getCommunicationRepository();
export const listCommunications = (options: FindManyCommunicationsOptions) =>
  getCommunicationRepository().findMany(options);
export const getCommunicationById = (id: string) => getCommunicationRepository().findById(id);
export const listCommunicationsForUser = (submitterUserId: string) =>
  getCommunicationRepository().findForUser(submitterUserId);
export const createCommunication = (input: CreateCommunicationInput) => getCommunicationRepository().create(input);
export const addCommunicationMessage = (id: string, input: AddCommunicationMessageInput) =>
  getCommunicationRepository().addMessage(id, input);
export const deleteCommunication = (id: string) => getCommunicationRepository().delete(id);

// inithium:block:contact:repositories:end
// inithium:block:staff:repositories:start
export const getStaffRepository = () => activeProvider.getStaffRepository();
export const listStaff = (options: FindManyStaffOptions) => getStaffRepository().findMany(options);
export const getStaffById = (id: string) => getStaffRepository().findById(id);
export const getStaffByUserId = (userId: string) => getStaffRepository().findByUserId(userId);
export const listStaffUserIds = () => getStaffRepository().listUserIds();
export const createStaff = (input: CreateStaffInput) => getStaffRepository().create(input);
export const updateStaff = (id: string, input: UpdateStaffInput) => getStaffRepository().update(id, input);
export const deleteStaff = (id: string) => getStaffRepository().delete(id);

// inithium:block:staff:repositories:end
// inithium:block:time:repositories:start
export const getTimeEntryRepository = () => activeProvider.getTimeEntryRepository();
export const findTimeEntryById = (id: string) => getTimeEntryRepository().findById(id);
export const findOpenTimeEntryByUserId = (userId: string) => getTimeEntryRepository().findOpenByUserId(userId);
export const listTimeEntriesInRange = (options: FindEntriesInRangeOptions) =>
  getTimeEntryRepository().findManyInRange(options);
export const listTimeEntriesForUsersInRange = (options: FindEntriesForUsersInRangeOptions) =>
  getTimeEntryRepository().findManyForUsersInRange(options);
export const findOverlappingTimeEntries = (userId: string, startAt: Date, endAt: Date | undefined, excludeId?: string) =>
  getTimeEntryRepository().findOverlapping(userId, startAt, endAt, excludeId);
export const countTimeEntriesByTypeId = (typeId: string) => getTimeEntryRepository().countByTypeId(typeId);
export const createTimeEntry = (input: CreateTimeEntryInput) => getTimeEntryRepository().create(input);
export const updateTimeEntry = (id: string, input: UpdateTimeEntryInput) => getTimeEntryRepository().update(id, input);
export const deleteTimeEntry = (id: string) => getTimeEntryRepository().delete(id);
export const deleteTimeEntriesInRange = (from: Date, to: Date) => getTimeEntryRepository().deleteInRange(from, to);

export const getTimeEntryTypeRepository = () => activeProvider.getTimeEntryTypeRepository();
// Self-seeding: the very first caller to ever ask for entry types (an employee's clock-in
// screen, or the settings admin screen) gets "General" for free. There is no main.ts boot hook
// available to plugins (see this plugin's db-provider.contract.ts fragment header note) - this
// mirrors the same lazy-provisioning idea the auto-clockout sweep already needs for a different
// one-time-default problem.
export const listTimeEntryTypes = async () => {
  const types = await getTimeEntryTypeRepository().findAll();
  if (types.length > 0) return types;
  const seeded = await getTimeEntryTypeRepository().create({ label: 'General', order: 0 });
  return [seeded];
};
export const findTimeEntryTypeById = (id: string) => getTimeEntryTypeRepository().findById(id);
export const countTimeEntryTypes = () => getTimeEntryTypeRepository().countAll();
export const createTimeEntryType = (input: CreateTimeEntryTypeInput) => getTimeEntryTypeRepository().create(input);
export const updateTimeEntryType = (id: string, input: UpdateTimeEntryTypeInput) =>
  getTimeEntryTypeRepository().update(id, input);
export const deleteTimeEntryType = (id: string) => getTimeEntryTypeRepository().delete(id);

export const getTimeSettingsRepository = () => activeProvider.getTimeSettingsRepository();
// Same self-seeding idea as listTimeEntryTypes above - the first read ever made creates the
// singleton with defaults rather than requiring a boot hook this plugin has no access to.
export const getTimeSettings = async () => (await getTimeSettingsRepository().get()) ?? getTimeSettingsRepository().upsert({});
export const updateTimeSettings = (input: UpdateTimeSettingsInput) => getTimeSettingsRepository().upsert(input);

export const getTimeAuditLogRepository = () => activeProvider.getTimeAuditLogRepository();
export const createTimeAuditLog = (input: CreateTimeAuditLogInput) => getTimeAuditLogRepository().create(input);
export const listTimeAuditLogByEntryId = (entryId: string) => getTimeAuditLogRepository().findByEntryId(entryId);
export const deleteTimeAuditLogsByEntryIds = (entryIds: string[]) => getTimeAuditLogRepository().deleteByEntryIds(entryIds);

// inithium:block:time:repositories:end
// inithium:block:policy:repositories:start
export const getPolicyRepository = () => activeProvider.getPolicyRepository();
export const listPolicyCategories = () => getPolicyRepository().findAll();
export const getPolicyCategoryById = (id: string) => getPolicyRepository().findCategoryById(id);
export const createPolicyCategory = (input: CreatePolicyCategoryInput) => getPolicyRepository().createCategory(input);
export const updatePolicyCategory = (id: string, input: UpdatePolicyCategoryInput) =>
  getPolicyRepository().updateCategory(id, input);
export const deletePolicyCategory = (id: string) => getPolicyRepository().deleteCategory(id);
export const createPolicyItem = (categoryId: string, input: CreatePolicyItemInput) =>
  getPolicyRepository().createItem(categoryId, input);
export const updatePolicyItem = (categoryId: string, itemId: string, input: UpdatePolicyItemInput) =>
  getPolicyRepository().updateItem(categoryId, itemId, input);
export const deletePolicyItem = (categoryId: string, itemId: string) =>
  getPolicyRepository().deleteItem(categoryId, itemId);

// inithium:block:policy:repositories:end
// inithium:block:classes:repositories:start
export const getClassRepository = () => activeProvider.getClassRepository();
export const listClasses = (options: FindManyClassesOptions) => getClassRepository().findMany(options);
export const listPublishedClasses = () => getClassRepository().findPublished();
export const createClass = (input: CreateClassInput) => getClassRepository().create(input);
export const updateClass = (id: string, input: UpdateClassInput) => getClassRepository().update(id, input);
export const deleteClass = (id: string) => getClassRepository().delete(id);

// inithium:block:classes:repositories:end
// inithium:block:children:repositories:start
export const getChildRepository = () => activeProvider.getChildRepository();
export const listChildren = (options: FindManyChildrenOptions) => getChildRepository().findMany(options);
export const getChildById = (id: string) => getChildRepository().findById(id);
export const listChildrenByParentUserId = (parentUserId: string) => getChildRepository().findByParentUserId(parentUserId);
export const createChild = (input: CreateChildInput) => getChildRepository().create(input);
export const updateChild = (id: string, input: UpdateChildInput) => getChildRepository().update(id, input);
export const deleteChild = (id: string) => getChildRepository().delete(id);
export const getChildrenCreatedByDay = () => getChildRepository().countCreatedByDay();

// inithium:block:children:repositories:end
// inithium:anchor:repositories

export type { DbProvider, DbConfig } from './contracts/db-provider.contract';
export type { PaginatedResult } from './contracts/pagination.contract';
export type {
  UserRepository,
  UserEntity,
  CreateUserInput,
  UpdateUserInput,
  UserSearchField,
  FindManyUsersOptions,
  UserRegistrationCount,
  Role,
  CapabilityOverrides,
} from './contracts/user.contract';
export { CORE_ROLES, AVATAR_VARIANTS, AVATAR_SHAPES, DEFAULT_AVATAR_CONFIG } from './contracts/user.contract';
export type {
  AvatarVariant,
  AvatarShape,
  AvatarColor,
  AvatarStyleConfig,
  AvatarDicebearConfig,
  AvatarConfig,
  UserProfileBannerConfig,
} from './contracts/user.contract';
export { NAV_LOCATIONS, PAGE_LAYOUT_TEMPLATES } from './contracts/page.contract';
export type {
  PageEntity,
  CreatePageInput,
  UpdatePageInput,
  PageRepository,
  PageAccessConfig,
  PageAnimationConfig,
  PageColorConfig,
  PageNavigationConfig,
  PageSeoConfig,
  NavLocation,
  PageLayoutTemplate,
  PageSearchField,
  FindManyPagesOptions,
} from './contracts/page.contract';
export type { NotificationEntity, CreateNotificationInput, NotificationRepository } from './contracts/notification.contract';
export { SETTING_TYPES } from './contracts/settings.contract';
export type { SettingType, SettingEntity, UpsertSettingInput, SettingsRepository } from './contracts/settings.contract';
// inithium:block:gallery:type-exports:start
export { GALLERY_IMAGE_SOURCE_TYPES } from './contracts/gallery-image.contract';
export type {
  GalleryImageEntity,
  CreateGalleryImageInput,
  UpdateGalleryImageInput,
  GalleryImageSourceType,
  GalleryImageSearchField,
  FindManyGalleryImagesOptions,
  FindPublishedGalleryImagesOptions,
  GalleryRepository,
} from './contracts/gallery-image.contract';
// inithium:block:gallery:type-exports:end
// inithium:block:contact:type-exports:start
export type {
  CommunicationEntity,
  CommunicationMessage,
  CommunicationAuthorRole,
  CreateCommunicationInput,
  AddCommunicationMessageInput,
  CommunicationSearchField,
  FindManyCommunicationsOptions,
  CommunicationRepository,
} from './contracts/communication.contract';
// inithium:block:contact:type-exports:end
// inithium:block:staff:type-exports:start
export { STAFF_PHOTO_SOURCE_TYPES } from './contracts/staff.contract';
export type {
  StaffEntity,
  CreateStaffInput,
  UpdateStaffInput,
  StaffPhotoSourceType,
  StaffSearchField,
  FindManyStaffOptions,
  StaffRepository,
} from './contracts/staff.contract';
// inithium:block:staff:type-exports:end
// inithium:block:time:type-exports:start
export { TIME_AUDIT_ACTIONS } from './contracts/time-audit-log.contract';
export type {
  TimeEntryEntity,
  CreateTimeEntryInput,
  UpdateTimeEntryInput,
  FindEntriesInRangeOptions,
  FindEntriesForUsersInRangeOptions,
  DeleteInRangeResult,
  TimeEntryRepository,
} from './contracts/time-entry.contract';
export type {
  TimeEntryTypeEntity,
  CreateTimeEntryTypeInput,
  UpdateTimeEntryTypeInput,
  TimeEntryTypeRepository,
} from './contracts/time-entry-type.contract';
export type { TimeSettingsEntity, UpdateTimeSettingsInput, TimeSettingsRepository } from './contracts/time-settings.contract';
export type {
  TimeAuditAction,
  TimeEntrySnapshot,
  TimeAuditLogEntity,
  CreateTimeAuditLogInput,
  TimeAuditLogRepository,
} from './contracts/time-audit-log.contract';
// inithium:block:time:type-exports:end
// inithium:block:policy:type-exports:start
export type {
  PolicyCategoryEntity,
  PolicyItemEntity,
  CreatePolicyCategoryInput,
  UpdatePolicyCategoryInput,
  CreatePolicyItemInput,
  UpdatePolicyItemInput,
  PolicyRepository,
} from './contracts/policy.contract';
// inithium:block:policy:type-exports:end
// inithium:block:classes:type-exports:start
export { DAYS_OF_WEEK } from './contracts/class.contract';
export type {
  ClassEntity,
  CreateClassInput,
  UpdateClassInput,
  DayOfWeek,
  ClassSearchField,
  FindManyClassesOptions,
  ClassRepository,
} from './contracts/class.contract';
// inithium:block:classes:type-exports:end
// inithium:block:children:type-exports:start
export { CHILD_GENDERS } from './contracts/child.contract';
export type {
  ChildEntity,
  CreateChildInput,
  UpdateChildInput,
  ChildGender,
  ChildSearchField,
  ChildRegistrationEntry,
  ChildAccountCount,
  FindManyChildrenOptions,
  ChildRepository,
} from './contracts/child.contract';
// inithium:block:children:type-exports:end
// inithium:anchor:type-exports
export { ensureSeededPages } from './page-seeds/ensureSeededPages';
export { pruneOrphanedPluginPages } from './page-seeds/pruneOrphanedPluginPages';
export { ensureSeededSettings } from './settings-seeds/ensureSeededSettings';
export { ensureOwnerBootstrap } from './bootstrap/ensureOwnerBootstrap';
export { ensureSeededPolicies } from './policy-seeds/ensureSeededPolicies';
export { mongoProvider } from './providers/mongo/mongo.provider';
