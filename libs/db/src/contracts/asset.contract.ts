export interface AssetEntity {
  id: string;
  publicUrl: string;
  // The S3 object key - needed by the route layer to call deleteObject/getSignedUrl against
  // @inithium/storage, since this DB record (not the key) is the real ownership source of truth.
  providerKey: string;
  // Reserved for a future thumbnail/image-processing pipeline - nothing populates this yet, same
  // "define the seam early" rationale as StorageProvider's own unused getSignedUrl.
  variants?: Record<string, string>;
  altText?: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  // Free-form, not a closed enum - purely descriptive of which upload flow created this asset
  // ('avatar', 'banner', 'blog', ...), used only to filter listForUser. A future plugin can
  // introduce its own purpose string without ever needing to touch this contract.
  purpose: string;
  createdAt: Date;
}

export type CreateAssetInput = Omit<AssetEntity, 'id' | 'createdAt'>;

export interface ListAssetsForUserOptions {
  readonly purposes?: string[];
}

export interface AssetRepository {
  create: (input: CreateAssetInput) => Promise<AssetEntity>;
  findById: (id: string) => Promise<AssetEntity | null>;
  delete: (id: string) => Promise<boolean>;
  // Newest first - a natural default for a gallery view, and not currently overridable since
  // nothing needs anything else yet.
  listForUser: (userId: string, options?: ListAssetsForUserOptions) => Promise<AssetEntity[]>;
}
