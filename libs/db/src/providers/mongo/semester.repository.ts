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
  name: doc.name,
  startDate: doc.startDate,
  endDate: doc.endDate,
  registrationOpensAt: doc.registrationOpensAt,
  isPublished: doc.isPublished,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoSemesterRepository = (model: Model<SemesterDocument>): SemesterRepository => ({
  findMany: async (options: FindManySemestersOptions): Promise<PaginatedResult<SemesterEntity>> => {
    const { page, pageSize, search, searchField } = options;
    const filter: QueryFilter<SemesterDocument> = {};
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
  create: async (input: CreateSemesterInput): Promise<SemesterEntity> => {
    const doc = await model.create(input);
    return mapToSemesterEntity(doc);
  },
  update: async (id: string, input: UpdateSemesterInput): Promise<SemesterEntity | null> => {
    const doc = await model.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    return doc ? mapToSemesterEntity(doc) : null;
  },
  delete: async (id: string): Promise<boolean> => {
    const result = await model.findByIdAndDelete(id).exec();
    return result !== null;
  },
});
