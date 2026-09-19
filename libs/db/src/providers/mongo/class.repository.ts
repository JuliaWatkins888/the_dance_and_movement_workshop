import type { Model, QueryFilter } from 'mongoose';
import {
  ClassEntity,
  ClassRepository,
  CreateClassInput,
  FindManyClassesOptions,
  FindManyClassesUnpagedOptions,
  FindPublishedClassesOptions,
  UpdateClassInput,
} from '../../contracts/class.contract';
import type { PaginatedResult } from '../../contracts/pagination.contract';
import { escapeRegExp } from '../../utils/escapeRegExp';
import { ClassDocument } from '../../schemas/class.schema';

const mapToClassEntity = (doc: ClassDocument): ClassEntity => ({
  id: doc._id.toString(),
  courseId: doc.courseId,
  variantLabel: doc.variantLabel,
  instructorIds: doc.instructorIds,
  daysOfWeek: doc.daysOfWeek,
  startTime: doc.startTime,
  endTime: doc.endTime,
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
    const { page, pageSize, search, searchField, courseId } = options;
    const filter: QueryFilter<ClassDocument> = {};
    if (courseId) {
      filter.courseId = courseId;
    }
    if (search && searchField) {
      filter[searchField] = { $regex: escapeRegExp(search), $options: 'i' };
    }

    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      model.find(filter).sort({ startDate: 1 }).skip(skip).limit(pageSize).exec(),
      model.countDocuments(filter).exec(),
    ]);

    return { items: docs.map(mapToClassEntity), total, page, pageSize };
  },
  findManyUnpaged: async (options: FindManyClassesUnpagedOptions): Promise<ClassEntity[]> => {
    const { search, searchField, courseId } = options;
    const filter: QueryFilter<ClassDocument> = {};
    if (courseId) {
      filter.courseId = courseId;
    }
    if (search && searchField) {
      filter[searchField] = { $regex: escapeRegExp(search), $options: 'i' };
    }

    const docs = await model.find(filter).exec();
    return docs.map(mapToClassEntity);
  },
  findPublished: async (options?: FindPublishedClassesOptions): Promise<ClassEntity[]> => {
    // A class whose endDate has passed is excluded from the public catalog entirely (not just
    // shown as unregisterable) - a parent browsing current offerings shouldn't see something
    // that's already over. The admin listings (findMany/findManyUnpaged) deliberately don't apply
    // this filter, so a class stays visible in the CMS after it ends until an admin removes it.
    const filter: QueryFilter<ClassDocument> = { isPublished: true, endDate: { $gte: new Date() } };
    if (options?.courseId) {
      filter.courseId = options.courseId;
    }
    if (options?.instructorId) {
      filter.instructorIds = options.instructorId;
    }
    const docs = await model.find(filter).sort({ startDate: 1 }).exec();
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
  countByCourseId: async (courseId: string): Promise<number> => model.countDocuments({ courseId }).exec(),
  countByCourseIds: async (courseIds: string[]): Promise<number> => model.countDocuments({ courseId: { $in: courseIds } }).exec(),
});
