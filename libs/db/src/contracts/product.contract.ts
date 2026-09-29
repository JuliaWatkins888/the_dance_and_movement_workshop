import type { PaginatedResult } from './pagination.contract';
import type { ClearableUpdate, ProductBilling } from './commerce.contract';

export const PRODUCT_IMAGE_SOURCE_TYPES = ['local', 'cloud', 'external'] as const;
export type ProductImageSourceType = (typeof PRODUCT_IMAGE_SOURCE_TYPES)[number];

export type ProductSearchField = 'name' | 'slug';

export interface ProductOption {
  name: string; // e.g. "Size"
  values: string[]; // e.g. ["S", "M", "L"]
}

// Every product has at least one variant - a product with no options simply has one variant with
// empty optionValues - so cart lines and stock always point at a variant and never need a
// "product-level vs variant-level" branch.
export interface ProductVariant {
  // Stable across edits (cart lines and order snapshots reference it), so the admin route keeps
  // existing ids and only mints new ones for newly added variants.
  id: string;
  sku?: string;
  optionValues: Record<string, string>;
  // Overrides the product's basePriceCents when set.
  priceCents?: number;
  // null = unlimited (tickets, digital goods); a number is decremented atomically on checkout.
  stockQuantity: number | null;
  isActive: boolean;
}

export interface ProductEntity {
  id: string;
  name: string;
  slug: string;
  description?: string;
  categories: string[];
  // Same resolved-once url + sourceType/assetId/storageKey shape as StaffEntity's photo, so the
  // storage-aware route variant can clean up the right underlying object on delete.
  imageUrl?: string;
  imageSourceType?: ProductImageSourceType;
  imageAssetId?: string;
  imageStorageKey?: string;
  basePriceCents: number;
  // Stripe Tax product tax code (e.g. "txcd_99999999" general tangible goods). Absent falls back
  // to the tax provider's account default.
  taxCode?: string;
  requiresShipping: boolean;
  billing: ProductBilling;
  options: ProductOption[];
  variants: ProductVariant[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateProductInput = Omit<ProductEntity, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateProductInput = ClearableUpdate<CreateProductInput>;

export interface FindManyProductsOptions {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: ProductSearchField;
}

// The storefront listing - published only, searched by name.
export interface FindPublishedProductsOptions {
  page: number;
  pageSize: number;
  category?: string;
  search?: string;
}

export interface ProductRepository {
  findMany: (options: FindManyProductsOptions) => Promise<PaginatedResult<ProductEntity>>;
  findPublished: (options: FindPublishedProductsOptions) => Promise<PaginatedResult<ProductEntity>>;
  // Distinct categories across published products, sorted - the storefront's filter choices.
  listPublishedCategories: () => Promise<string[]>;
  // Every category in use, published or not - the admin editor's suggestions.
  listAllCategories: () => Promise<string[]>;
  findById: (id: string) => Promise<ProductEntity | null>;
  findBySlug: (slug: string) => Promise<ProductEntity | null>;
  create: (input: CreateProductInput) => Promise<ProductEntity>;
  update: (id: string, input: UpdateProductInput) => Promise<ProductEntity | null>;
  delete: (id: string) => Promise<boolean>;
  // Atomic conditional decrement - false when the variant has fewer than `quantity` left, so two
  // concurrent checkouts can never both claim the last unit. Always true for unlimited stock.
  reserveVariantStock: (productId: string, variantId: string, quantity: number) => Promise<boolean>;
  releaseVariantStock: (productId: string, variantId: string, quantity: number) => Promise<void>;
}
