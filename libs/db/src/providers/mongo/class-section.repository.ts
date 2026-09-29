import { isValidObjectId } from 'mongoose';
import type { Model, QueryFilter } from 'mongoose';
import type {
  ClassSectionEntity,
  ClassSectionRepository,
  CreateClassSectionInput,
  FindClassSectionsOptions,
  UpdateClassSectionInput,
} from '../../contracts/class-section.contract';
import { toUpdateOperations } from '../../utils/toUpdateOperations';
import type { ClassSectionDocument } from '../../schemas/class-section.schema';

const mapToClassSectionEntity = (doc: ClassSectionDocument): ClassSectionEntity => ({
  id: doc._id.toString(),
  courseId: doc.courseId,
  schoolYearId: doc.schoolYearId,
  semesterIds: doc.semesterIds ?? [],
  instructorStaffIds: doc.instructorStaffIds ?? [],
  daysOfWeek: doc.daysOfWeek ?? [],
  startTime: doc.startTime,
  endTime: doc.endTime,
  capacity: doc.capacity,
  enrolled: doc.enrolled,
  isPublished: doc.isPublished,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoClassSectionRepository = (model: Model<ClassSectionDocument>): ClassSectionRepository => ({
  findAll: async (options: FindClassSectionsOptions = {}) => {
    const filter: QueryFilter<ClassSectionDocument> = {};
    if (options.courseId) filter.courseId = options.courseId;
    if (options.schoolYearId) filter.schoolYearId = options.schoolYearId;
    const docs = await model.find(filter).sort({ startTime: 1 }).exec();
    return docs.map(mapToClassSectionEntity);
  },
  findById: async (id: string) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapToClassSectionEntity(doc) : null;
  },
  create: async (input: CreateClassSectionInput) => mapToClassSectionEntity(await model.create(input)),
  update: async (id: string, input: UpdateClassSectionInput) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findByIdAndUpdate(id, toUpdateOperations(input), { new: true, runValidators: true }).exec();
    return doc ? mapToClassSectionEntity(doc) : null;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) return false;
    return (await model.findByIdAndDelete(id).exec()) !== null;
  },
  reserveSeats: async (id: string, count: number) => {
    if (!isValidObjectId(id)) return false;
    const result = await model
      .updateOne({ _id: id, $expr: { $lte: [{ $add: ['$enrolled', count] }, '$capacity'] } }, { $inc: { enrolled: count } })
      .exec();
    return result.modifiedCount === 1;
  },
  releaseSeats: async (id: string, count: number) => {
    if (!isValidObjectId(id)) return;
    await model.updateOne({ _id: id, enrolled: { $gte: count } }, { $inc: { enrolled: -count } }).exec();
  },
});
