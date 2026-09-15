import type { Model, QueryFilter } from 'mongoose';
import {
  ClassEntity,
  ClassRepository,
  CreateClassInput,
  FindManyClassesOptions,
  UpdateClassInput,
} from '../../contracts/class.contract';
import type { PaginatedResult } from '../../contracts/pagination.contract';
import { escapeRegExp } from '../../utils/escapeRegExp';
import { ClassDocument } from '../../schemas/class.schema';

const mapToClassEntity = (doc: ClassDocument): ClassEntity => ({
  id: doc._id.toString(),
  name: doc.name,
  description: doc.description,
  categories: doc.categories,
  instructors: doc.instructors,
  daysOfWeek: doc.daysOfWeek,
  startTime: doc.startTime,
  endTime: doc.endTime,
  session: doc.session,
  registrationStartDate: doc.registrationStartDate,
  startDate: doc.startDate,
  endDate: doc.endDate,
  minAgeYears: doc.minAgeYears,
  maxAgeYears: doc.maxAgeYears,
  priceAmount: doc.priceAmount,
  billingCycle: doc.billingCycle,
  capacity: doc.capacity,
  enrolled: doc.enrolled,
  isPublished: doc.isPublished,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoClassRepository = (model: Model<ClassDocument>): ClassRepository => ({
  findMany: async (options: FindManyClassesOptions): Promise<PaginatedResult<ClassEntity>> => {
    const { page, pageSize, search, searchField } = options;
    const filter: QueryFilter<ClassDocument> = {};
    if (search && searchField) {
      filter[searchField] = { $regex: escapeRegExp(search), $options: 'i' };
    }

    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      model.find(filter).sort({ startDate: 1, name: 1 }).skip(skip).limit(pageSize).exec(),
      model.countDocuments(filter).exec(),
    ]);

    return { items: docs.map(mapToClassEntity), total, page, pageSize };
  },
  findPublished: async (): Promise<ClassEntity[]> => {
    const docs = await model.find({ isPublished: true }).sort({ startDate: 1, name: 1 }).exec();
    return docs.map(mapToClassEntity);
  },
  create: async (input: CreateClassInput): Promise<ClassEntity> => {
    const doc = await model.create(input);
    return mapToClassEntity(doc);
  },
  update: async (id: string, input: UpdateClassInput): Promise<ClassEntity | null> => {
    const doc = await model.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    return doc ? mapToClassEntity(doc) : null;
  },
  delete: async (id: string): Promise<boolean> => {
    const result = await model.findByIdAndDelete(id).exec();
    return result !== null;
  },
});
