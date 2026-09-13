import type { Model, QueryFilter } from 'mongoose';
import {
  CreateStaffInput,
  FindManyStaffOptions,
  StaffEntity,
  StaffRepository,
  UpdateStaffInput,
} from '../../contracts/staff.contract';
import type { PaginatedResult } from '../../contracts/pagination.contract';
import { escapeRegExp } from '../../utils/escapeRegExp';
import { StaffDocument } from '../../schemas/staff.schema';

const mapToStaffEntity = (doc: StaffDocument): StaffEntity => ({
  id: doc._id.toString(),
  userId: doc.userId,
  title: doc.title,
  bio: doc.bio,
  photoUrl: doc.photoUrl,
  photoSourceType: doc.photoSourceType,
  photoAssetId: doc.photoAssetId,
  photoStorageKey: doc.photoStorageKey,
  order: doc.order,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoStaffRepository = (model: Model<StaffDocument>): StaffRepository => ({
  findMany: async (options: FindManyStaffOptions): Promise<PaginatedResult<StaffEntity>> => {
    const { page, pageSize, search, searchField } = options;
    const filter: QueryFilter<StaffDocument> = {};
    if (search && searchField) {
      filter[searchField] = { $regex: escapeRegExp(search), $options: 'i' };
    }

    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      model.find(filter).sort({ order: 1, createdAt: 1 }).skip(skip).limit(pageSize).exec(),
      model.countDocuments(filter).exec(),
    ]);

    return { items: docs.map(mapToStaffEntity), total, page, pageSize };
  },
  findById: async (id: string): Promise<StaffEntity | null> => {
    const doc = await model.findById(id).exec();
    return doc ? mapToStaffEntity(doc) : null;
  },
  findByUserId: async (userId: string): Promise<StaffEntity | null> => {
    const doc = await model.findOne({ userId }).exec();
    return doc ? mapToStaffEntity(doc) : null;
  },
  listUserIds: async (): Promise<string[]> => {
    const docs = await model.find().select('userId').exec();
    return docs.map((doc) => doc.userId);
  },
  create: async (input: CreateStaffInput): Promise<StaffEntity> => {
    const doc = await model.create(input);
    return mapToStaffEntity(doc);
  },
  update: async (id: string, input: UpdateStaffInput): Promise<StaffEntity | null> => {
    const doc = await model.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    return doc ? mapToStaffEntity(doc) : null;
  },
  delete: async (id: string): Promise<boolean> => {
    const result = await model.findByIdAndDelete(id).exec();
    return result !== null;
  },
});
