import type { Model, QueryFilter } from 'mongoose';
import {
  CreateWorkshopInput,
  FindManyWorkshopsOptions,
  FindPublishedWorkshopsOptions,
  UpdateWorkshopInput,
  WorkshopEntity,
  WorkshopRepository,
} from '../../contracts/workshop.contract';
import type { PaginatedResult } from '../../contracts/pagination.contract';
import { escapeRegExp } from '../../utils/escapeRegExp';
import { WorkshopDocument } from '../../schemas/workshop.schema';

// Ascending by date - a workshop's own occurrences render as "Fri, Sat, Sun", not the array's
// insertion order.
const earliestOccurrenceTime = (doc: WorkshopDocument): number =>
  doc.occurrences.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...doc.occurrences.map((occurrence) => occurrence.date.getTime()));

const mapToWorkshopEntity = (doc: WorkshopDocument): WorkshopEntity => ({
  id: doc._id.toString(),
  semesterId: doc.semesterId,
  name: doc.name,
  description: doc.description ?? undefined,
  instructorIds: doc.instructorIds,
  occurrences: [...doc.occurrences]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((occurrence) => ({
      id: occurrence._id.toString(),
      date: occurrence.date,
      startTime: occurrence.startTime,
      endTime: occurrence.endTime,
    })),
  minAgeYears: doc.minAgeYears ?? undefined,
  maxAgeYears: doc.maxAgeYears ?? undefined,
  priceAmount: doc.priceAmount,
  registrationStartDate: doc.registrationStartDate ?? undefined,
  capacity: doc.capacity,
  enrolled: doc.enrolled,
  isPublished: doc.isPublished,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoWorkshopRepository = (model: Model<WorkshopDocument>): WorkshopRepository => ({
  findMany: async (options: FindManyWorkshopsOptions): Promise<PaginatedResult<WorkshopEntity>> => {
    const { page, pageSize, search, searchField, semesterId } = options;
    const filter: QueryFilter<WorkshopDocument> = {};
    if (semesterId) {
      filter.semesterId = semesterId;
    }
    if (search && searchField) {
      filter[searchField] = { $regex: escapeRegExp(search), $options: 'i' };
    }

    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      model.find(filter).sort({ name: 1 }).skip(skip).limit(pageSize).exec(),
      model.countDocuments(filter).exec(),
    ]);

    return { items: docs.map(mapToWorkshopEntity), total, page, pageSize };
  },
  findPublished: async (options?: FindPublishedWorkshopsOptions): Promise<WorkshopEntity[]> => {
    // A workshop whose every occurrence has already passed is excluded from the public catalog
    // entirely, mirroring Class's own findPublished filter - $elemMatch here means "at least one
    // occurrence is still upcoming", i.e. it isn't fully over yet. Admin listings (findMany)
    // deliberately don't apply this, so it stays visible in the CMS until an admin removes it.
    const filter: QueryFilter<WorkshopDocument> = { isPublished: true, occurrences: { $elemMatch: { date: { $gte: new Date() } } } };
    if (options?.instructorId) {
      filter.instructorIds = options.instructorId;
    }
    const docs = await model.find(filter).exec();
    return [...docs].sort((a, b) => earliestOccurrenceTime(a) - earliestOccurrenceTime(b)).map(mapToWorkshopEntity);
  },
  create: async (input: CreateWorkshopInput): Promise<WorkshopEntity> => {
    const doc = await model.create(input);
    return mapToWorkshopEntity(doc);
  },
  update: async (id: string, input: UpdateWorkshopInput): Promise<WorkshopEntity | null> => {
    const doc = await model.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    return doc ? mapToWorkshopEntity(doc) : null;
  },
  delete: async (id: string): Promise<boolean> => {
    const result = await model.findByIdAndDelete(id).exec();
    return result !== null;
  },
  countBySemesterIds: async (semesterIds: string[]): Promise<number> => model.countDocuments({ semesterId: { $in: semesterIds } }).exec(),
});
