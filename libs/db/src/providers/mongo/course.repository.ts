import type { Model, QueryFilter } from 'mongoose';
import {
  CourseEntity,
  CourseRepository,
  CreateCourseInput,
  FindManyCoursesOptions,
  UpdateCourseInput,
} from '../../contracts/course.contract';
import type { PaginatedResult } from '../../contracts/pagination.contract';
import { escapeRegExp } from '../../utils/escapeRegExp';
import { CourseDocument } from '../../schemas/course.schema';

const mapToCourseEntity = (doc: CourseDocument): CourseEntity => ({
  id: doc._id.toString(),
  academicYearId: doc.academicYearId,
  semesterIds: doc.semesterIds,
  name: doc.name,
  description: doc.description ?? undefined,
  categories: doc.categories,
  imageUrl: doc.imageUrl ?? undefined,
  imageSourceType: doc.imageSourceType ?? undefined,
  imageAssetId: doc.imageAssetId ?? undefined,
  imageStorageKey: doc.imageStorageKey ?? undefined,
  copiedFromId: doc.copiedFromId ?? undefined,
  isPublished: doc.isPublished,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoCourseRepository = (model: Model<CourseDocument>): CourseRepository => ({
  findMany: async (options: FindManyCoursesOptions): Promise<PaginatedResult<CourseEntity>> => {
    const { page, pageSize, search, searchField, academicYearId, semesterId } = options;
    const filter: QueryFilter<CourseDocument> = {};
    if (academicYearId) {
      filter.academicYearId = academicYearId;
    }
    if (semesterId) {
      filter.semesterIds = semesterId;
    }
    if (search && searchField) {
      filter[searchField] = { $regex: escapeRegExp(search), $options: 'i' };
    }

    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      model.find(filter).sort({ name: 1 }).skip(skip).limit(pageSize).exec(),
      model.countDocuments(filter).exec(),
    ]);

    return { items: docs.map(mapToCourseEntity), total, page, pageSize };
  },
  findPublished: async (): Promise<CourseEntity[]> => {
    const docs = await model.find({ isPublished: true }).sort({ name: 1 }).exec();
    return docs.map(mapToCourseEntity);
  },
  findByAcademicYearId: async (academicYearId: string): Promise<CourseEntity[]> => {
    const docs = await model.find({ academicYearId }).sort({ name: 1 }).exec();
    return docs.map(mapToCourseEntity);
  },
  findById: async (id: string): Promise<CourseEntity | null> => {
    const doc = await model.findById(id).exec();
    return doc ? mapToCourseEntity(doc) : null;
  },
  create: async (input: CreateCourseInput): Promise<CourseEntity> => {
    const doc = await model.create(input);
    return mapToCourseEntity(doc);
  },
  update: async (id: string, input: UpdateCourseInput): Promise<CourseEntity | null> => {
    const doc = await model.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    return doc ? mapToCourseEntity(doc) : null;
  },
  delete: async (id: string): Promise<boolean> => {
    const result = await model.findByIdAndDelete(id).exec();
    return result !== null;
  },
  countByAcademicYearId: async (academicYearId: string): Promise<number> => model.countDocuments({ academicYearId }).exec(),
});
