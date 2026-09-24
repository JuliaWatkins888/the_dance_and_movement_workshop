import type { Model, QueryFilter } from 'mongoose';
import {
  AcademicYearEntity,
  AcademicYearRepository,
  CreateAcademicYearInput,
  FindManyAcademicYearsUnpagedOptions,
  UpdateAcademicYearInput,
} from '../../contracts/academic-year.contract';
import { escapeRegExp } from '../../utils/escapeRegExp';
import { AcademicYearDocument } from '../../schemas/academic-year.schema';

const mapToAcademicYearEntity = (doc: AcademicYearDocument): AcademicYearEntity => ({
  id: doc._id.toString(),
  title: doc.title,
  description: doc.description ?? undefined,
  isPublished: doc.isPublished,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoAcademicYearRepository = (model: Model<AcademicYearDocument>): AcademicYearRepository => ({
  findManyUnpaged: async (options?: FindManyAcademicYearsUnpagedOptions): Promise<AcademicYearEntity[]> => {
    const filter: QueryFilter<AcademicYearDocument> = {};
    if (options?.search && options.searchField) {
      filter[options.searchField] = { $regex: escapeRegExp(options.search), $options: 'i' };
    }
    const docs = await model.find(filter).exec();
    return docs.map(mapToAcademicYearEntity);
  },
  findPublished: async (): Promise<AcademicYearEntity[]> => {
    const docs = await model.find({ isPublished: true }).exec();
    return docs.map(mapToAcademicYearEntity);
  },
  findById: async (id: string): Promise<AcademicYearEntity | null> => {
    const doc = await model.findById(id).exec();
    return doc ? mapToAcademicYearEntity(doc) : null;
  },
  create: async (input: CreateAcademicYearInput): Promise<AcademicYearEntity> => {
    const doc = await model.create(input);
    return mapToAcademicYearEntity(doc);
  },
  update: async (id: string, input: UpdateAcademicYearInput): Promise<AcademicYearEntity | null> => {
    const doc = await model.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    return doc ? mapToAcademicYearEntity(doc) : null;
  },
  delete: async (id: string): Promise<boolean> => {
    const result = await model.findByIdAndDelete(id).exec();
    return result !== null;
  },
});
