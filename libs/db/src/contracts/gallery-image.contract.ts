import type { PaginatedResult } from './pagination.contract';
import type { ClearableUpdate } from './commerce.contract';

export const GALLERY_IMAGE_SOURCE_TYPES = ['cloud', 'external'] as const;
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
  // time (the R2 public URL or a pasted external URL), so nothing downstream ever needs to branch
  // on sourceType just to render an image.
  url: string;
  // cloud only - the storage plugin's AssetEntity id, needed to release the underlying R2 object
  // when the image is replaced or deleted.
  assetId?: string;
  isPublished: boolean;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateGalleryImageInput = Omit<GalleryImageEntity, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateGalleryImageInput = ClearableUpdate<CreateGalleryImageInput>;

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
