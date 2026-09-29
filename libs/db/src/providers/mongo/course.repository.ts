import { isValidObjectId } from 'mongoose';
import type { Model, QueryFilter } from 'mongoose';
import type {
  CourseEntity,
  CourseRepository,
  CreateCourseInput,
  FindCoursesOptions,
  UpdateCourseInput,
} from '../../contracts/course.contract';
import { toUpdateOperations } from '../../utils/toUpdateOperations';
import type { CourseDocument } from '../../schemas/course.schema';

const mapToCourseEntity = (doc: CourseDocument): CourseEntity => ({
  id: doc._id.toString(),
  programId: doc.programId,
  name: doc.name,
  slug: doc.slug,
  description: doc.description ?? undefined,
  dressCode: doc.dressCode ?? undefined,
  styles: doc.styles ?? [],
  level: doc.level ?? undefined,
  minAgeYears: doc.minAgeYears ?? undefined,
  maxAgeYears: doc.maxAgeYears ?? undefined,
  monthlyPriceCents: doc.monthlyPriceCents,
  order: doc.order,
  isPublished: doc.isPublished,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoCourseRepository = (model: Model<CourseDocument>): CourseRepository => ({
  findAll: async (options: FindCoursesOptions = {}) => {
    const filter: QueryFilter<CourseDocument> = {};
    if (options.programId) filter.programId = options.programId;
    const docs = await model.find(filter).sort({ order: 1, name: 1 }).exec();
    return docs.map(mapToCourseEntity);
  },
  findById: async (id: string) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapToCourseEntity(doc) : null;
  },
  findBySlug: async (slug: string) => {
    const doc = await model.findOne({ slug }).exec();
    return doc ? mapToCourseEntity(doc) : null;
  },
  create: async (input: CreateCourseInput) => mapToCourseEntity(await model.create(input)),
  update: async (id: string, input: UpdateCourseInput) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findByIdAndUpdate(id, toUpdateOperations(input), { new: true, runValidators: true }).exec();
    return doc ? mapToCourseEntity(doc) : null;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) return false;
    return (await model.findByIdAndDelete(id).exec()) !== null;
  },
});
