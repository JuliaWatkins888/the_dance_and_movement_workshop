import type { Model, QueryFilter } from 'mongoose';
import {
  SemesterEntity,
  SemesterRepository,
  CreateSemesterInput,
  FindManySemestersOptions,
  UpdateSemesterInput,
} from '../../contracts/semester.contract';
import type { PaginatedResult } from '../../contracts/pagination.contract';
import { escapeRegExp } from '../../utils/escapeRegExp';
import { SemesterDocument } from '../../schemas/semester.schema';

const mapToSemesterEntity = (doc: SemesterDocument): SemesterEntity => ({
  id: doc._id.toString(),
  academicYearId: doc.academicYearId,
  term: doc.term,
  name: doc.name,
  startDate: doc.startDate,
  endDate: doc.endDate,
  registrationOpensAt: doc.registrationOpensAt ?? undefined,
  isPublished: doc.isPublished,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoSemesterRepository = (model: Model<SemesterDocument>): SemesterRepository => ({
  findMany: async (options: FindManySemestersOptions): Promise<PaginatedResult<SemesterEntity>> => {
    const { page, pageSize, search, searchField, academicYearId } = options;
    const filter: QueryFilter<SemesterDocument> = {};
    if (academicYearId) {
      filter.academicYearId = academicYearId;
    }
    if (search && searchField) {
      filter[searchField] = { $regex: escapeRegExp(search), $options: 'i' };
    }

    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      model.find(filter).sort({ startDate: 1 }).skip(skip).limit(pageSize).exec(),
      model.countDocuments(filter).exec(),
    ]);

    return { items: docs.map(mapToSemesterEntity), total, page, pageSize };
  },
  findById: async (id: string): Promise<SemesterEntity | null> => {
    const doc = await model.findById(id).exec();
    return doc ? mapToSemesterEntity(doc) : null;
  },
  findByIds: async (ids: string[]): Promise<SemesterEntity[]> => {
    const docs = await model.find({ _id: { $in: ids } }).sort({ startDate: 1 }).exec();
    return docs.map(mapToSemesterEntity);
  },
  findByAcademicYearId: async (academicYearId: string): Promise<SemesterEntity[]> => {
    const docs = await model.find({ academicYearId }).sort({ startDate: 1 }).exec();
    return docs.map(mapToSemesterEntity);
  },
  create: async (input: CreateSemesterInput): Promise<SemesterEntity> => {
    const doc = await model.create(input);
    return mapToSemesterEntity(doc);
  },
  update: async (id: string, input: UpdateSemesterInput): Promise<SemesterEntity | null> => {
    const doc = await model.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    return doc ? mapToSemesterEntity(doc) : null;
  },
  deleteByAcademicYearId: async (academicYearId: string): Promise<number> => {
    const result = await model.deleteMany({ academicYearId }).exec();
    return result.deletedCount;
  },
});
