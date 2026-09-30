import type { ProductImageSourceType } from '@inithium/db';

export interface ProductImageValue {
  imageUrl?: string;
  imageSourceType?: ProductImageSourceType;
  imageAssetId?: string;
}

// ProductImageField implements this so ProductEditDialog can finish a pending crop/upload on save.
export interface ProductImageFieldHandle {
  // The image to save - finishing any upload still in progress first.
  finalize: () => Promise<ProductImageValue>;
}

export interface ProductImageFieldProps {
  readonly initial: ProductImageValue;
}
