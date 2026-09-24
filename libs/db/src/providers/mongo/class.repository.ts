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

// Optional fields are `?? undefined` here (and in the sibling repositories) because Mongo can hold an
// explicit null for a field that was never set - the raw driver serializes undefined as null - while
// the entity contract says "absent". A null that leaked into the API would arrive in the CMS as
// String(null) === "null" in a number input, and round-trip back as a rejected null on save.
const mapToClassEntity = (doc: ClassDocument): ClassEntity => ({
  id: doc._id.toString(),
  courseId: doc.courseId,
  semesterIds: doc.semesterIds,
  variantLabel: doc.variantLabel ?? undefined,
  instructorIds: doc.instructorIds,
  daysOfWeek: doc.daysOfWeek,
  startTime: doc.startTime,
  endTime: doc.endTime,
  registrationStartDate: doc.registrationStartDate ?? undefined,
  startDate: doc.startDate,
  endDate: doc.endDate,
  minAgeYears: doc.minAgeYears ?? undefined,
  maxAgeYears: doc.maxAgeYears ?? undefined,
  priceAmount: doc.priceAmount,
  capacity: doc.capacity,
  enrolled: doc.enrolled,
  copiedFromId: doc.copiedFromId ?? undefined,
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
  findById: async (id: string): Promise<ClassEntity | null> => {
    const doc = await model.findById(id).exec();
    return doc ? mapToClassEntity(doc) : null;
  },
  findByCourseIds: async (courseIds: string[]): Promise<ClassEntity[]> => {
    const docs = await model.find({ courseId: { $in: courseIds } }).sort({ startDate: 1 }).exec();
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
