import type { PaginatedResult } from './pagination.contract';

export const STAFF_PHOTO_SOURCE_TYPES = ['local', 'cloud', 'external'] as const;
export type StaffPhotoSourceType = (typeof STAFF_PHOTO_SOURCE_TYPES)[number];

export type StaffSearchField = 'title';

export interface StaffEntity {
  id: string;
  // References UserEntity.id - the matching user account this record's name/email are resolved
  // from at the API layer (see staff.route.ts's toStaffDto). Staff never stores its own copy of a
  // name or email - the user collection stays the single source of truth for both.
  userId: string;
  title: string;
  bio?: string;
  photoUrl?: string;
  // Mirrors GalleryImageEntity's own sourceType/assetId/storageKey trio (see
  // gallery-image.contract.ts) so photo cleanup on delete can find and remove the right
  // underlying file/object - all undefined when no photo has ever been set, since a photo is
  // entirely optional here (unlike a gallery image).
  photoSourceType?: StaffPhotoSourceType;
  photoAssetId?: string;
  photoStorageKey?: string;
  // Display order on the public staff page (ascending, ties broken by createdAt) - lets an admin
  // control who appears first without that being tied to creation order.
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateStaffInput = Omit<StaffEntity, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateStaffInput = Partial<CreateStaffInput>;

export interface FindManyStaffOptions {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: StaffSearchField;
}

export interface StaffRepository {
  findMany: (options: FindManyStaffOptions) => Promise<PaginatedResult<StaffEntity>>;
  findById: (id: string) => Promise<StaffEntity | null>;
  findByUserId: (userId: string) => Promise<StaffEntity | null>;
  // Every currently-linked userId, across all staff records - lets the CMS's user picker exclude
  // already-staffed users without fetching every full staff record just to read one field off
  // each.
  listUserIds: () => Promise<string[]>;
  create: (input: CreateStaffInput) => Promise<StaffEntity>;
  update: (id: string, input: UpdateStaffInput) => Promise<StaffEntity | null>;
  delete: (id: string) => Promise<boolean>;
}
