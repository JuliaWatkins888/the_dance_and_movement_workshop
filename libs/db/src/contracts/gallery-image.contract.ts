import type { PaginatedResult } from './pagination.contract';

export const GALLERY_IMAGE_SOURCE_TYPES = ['local', 'cloud', 'external'] as const;
export type GalleryImageSourceType = (typeof GALLERY_IMAGE_SOURCE_TYPES)[number];

export type GalleryImageSearchField = 'title';

export interface GalleryImageEntity {
  id: string;
  title: string;
  description?: string;
  altText?: string;
  // Free-form, not a closed shape - the "meta data, etc." requirement this satisfies is
  // intentionally open-ended (camera/location/tags/whatever an admin wants), mirroring
  // AssetEntity.variants' own "define the seam, let callers decide what goes in it" rationale.
  metadata?: Record<string, unknown>;
  sourceType: GalleryImageSourceType;
  // Always a directly-usable <img src> value regardless of sourceType - resolved once at write
  // time (S3 public URL, this API's own /api/gallery/uploads/:filename URL, or a pasted external
  // URL), so nothing downstream ever needs to branch on sourceType just to render an image.
  url: string;
  // cloud only - the storage plugin's AssetEntity id, needed by the storage-aware route variant
  // to clean up the underlying S3 object on delete. This DB record (not the id) is still the
  // real ownership source of truth, same rationale as AssetEntity.providerKey's own comment.
  assetId?: string;
  // local only - the filename under apps/api/uploads/gallery, needed by the route layer to
  // unlink the file on delete.
  storageKey?: string;
  isPublished: boolean;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateGalleryImageInput = Omit<GalleryImageEntity, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateGalleryImageInput = Partial<CreateGalleryImageInput>;

export interface FindManyGalleryImagesOptions {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: GalleryImageSearchField;
}

export interface FindPublishedGalleryImagesOptions {
  page: number;
  pageSize: number;
}

export interface GalleryRepository {
  // Includes drafts - the CMS admin list's source, never rendered on the public page.
  findMany: (options: FindManyGalleryImagesOptions) => Promise<PaginatedResult<GalleryImageEntity>>;
  // Published-only - the public gallery page's source.
  findPublished: (options: FindPublishedGalleryImagesOptions) => Promise<PaginatedResult<GalleryImageEntity>>;
  findById: (id: string) => Promise<GalleryImageEntity | null>;
  create: (input: CreateGalleryImageInput) => Promise<GalleryImageEntity>;
  update: (id: string, input: UpdateGalleryImageInput) => Promise<GalleryImageEntity | null>;
  delete: (id: string) => Promise<boolean>;
}
