import type { Model, QueryFilter } from 'mongoose';
import { AssetEntity, AssetRepository, CreateAssetInput, ListAssetsForUserOptions } from '../../contracts/asset.contract';
import { AssetDocument } from '../../schemas/asset.schema';

const mapToAssetEntity = (doc: AssetDocument): AssetEntity => ({
  id: doc._id.toString(),
  publicUrl: doc.publicUrl,
  providerKey: doc.providerKey,
  variants: doc.variants,
  altText: doc.altText,
  mimeType: doc.mimeType,
  sizeBytes: doc.sizeBytes,
  uploadedBy: doc.uploadedBy,
  purpose: doc.purpose,
  createdAt: doc.createdAt,
});

export const createMongoAssetRepository = (model: Model<AssetDocument>): AssetRepository => ({
  create: async (input: CreateAssetInput): Promise<AssetEntity> => {
    const asset = await model.create(input);
    return mapToAssetEntity(asset);
  },
  findById: async (id: string): Promise<AssetEntity | null> => {
    const asset = await model.findById(id).exec();
    return asset ? mapToAssetEntity(asset) : null;
  },
  delete: async (id: string): Promise<boolean> => {
    const result = await model.findByIdAndDelete(id).exec();
    return result !== null;
  },
  listForUser: async (userId: string, options?: ListAssetsForUserOptions): Promise<AssetEntity[]> => {
    const filter: QueryFilter<AssetDocument> = { uploadedBy: userId };
    if (options?.purposes?.length) {
      filter.purpose = { $in: options.purposes };
    }
    const docs = await model.find(filter).sort({ createdAt: -1 }).exec();
    return docs.map(mapToAssetEntity);
  },
});
