import type { Model, QueryFilter } from 'mongoose';
import {
  CreateGalleryImageInput,
  FindManyGalleryImagesOptions,
  FindPublishedGalleryImagesOptions,
  GalleryImageEntity,
  GalleryRepository,
  UpdateGalleryImageInput,
} from '../../contracts/gallery-image.contract';
import type { PaginatedResult } from '../../contracts/pagination.contract';
import { escapeRegExp } from '../../utils/escapeRegExp';
import { GalleryImageDocument } from '../../schemas/gallery-image.schema';

const mapToGalleryImageEntity = (doc: GalleryImageDocument): GalleryImageEntity => ({
  id: doc._id.toString(),
  title: doc.title,
  description: doc.description,
  altText: doc.altText,
  metadata: doc.metadata,
  sourceType: doc.sourceType,
  url: doc.url,
  assetId: doc.assetId,
  storageKey: doc.storageKey,
  isPublished: doc.isPublished,
  uploadedBy: doc.uploadedBy,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoGalleryImageRepository = (model: Model<GalleryImageDocument>): GalleryRepository => ({
  findMany: async (options: FindManyGalleryImagesOptions): Promise<PaginatedResult<GalleryImageEntity>> => {
    const { page, pageSize, search, searchField } = options;
    const filter: QueryFilter<GalleryImageDocument> = {};
    if (search && searchField) {
      filter[searchField] = { $regex: escapeRegExp(search), $options: 'i' };
    }

    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).exec(),
      model.countDocuments(filter).exec(),
    ]);

    return { items: docs.map(mapToGalleryImageEntity), total, page, pageSize };
  },
  findPublished: async (options: FindPublishedGalleryImagesOptions): Promise<PaginatedResult<GalleryImageEntity>> => {
    const { page, pageSize } = options;
    const filter: QueryFilter<GalleryImageDocument> = { isPublished: true };

    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).exec(),
      model.countDocuments(filter).exec(),
    ]);

    return { items: docs.map(mapToGalleryImageEntity), total, page, pageSize };
  },
  findById: async (id: string): Promise<GalleryImageEntity | null> => {
    const doc = await model.findById(id).exec();
    return doc ? mapToGalleryImageEntity(doc) : null;
  },
  create: async (input: CreateGalleryImageInput): Promise<GalleryImageEntity> => {
    const doc = await model.create(input);
    return mapToGalleryImageEntity(doc);
  },
  update: async (id: string, input: UpdateGalleryImageInput): Promise<GalleryImageEntity | null> => {
    const doc = await model.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    return doc ? mapToGalleryImageEntity(doc) : null;
  },
  delete: async (id: string): Promise<boolean> => {
    const result = await model.findByIdAndDelete(id).exec();
    return result !== null;
  },
});
