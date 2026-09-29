import type { ProductImageSourceType } from '@inithium/db';

export interface ProductImageValue {
  imageUrl?: string;
  imageSourceType?: ProductImageSourceType;
  imageAssetId?: string;
  imageStorageKey?: string;
}

// Both ProductImageField variants (plain, and the storage-aware one swapped in when the storage
// plugin is installed) implement this, so ProductEditDialog works unchanged with either.
export interface ProductImageFieldHandle {
  // The image to save - finishing any upload still in progress first.
  finalize: () => Promise<ProductImageValue>;
}

export interface ProductImageFieldProps {
  readonly initial: ProductImageValue;
}
