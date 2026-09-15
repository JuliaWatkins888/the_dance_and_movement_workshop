import type { Model, QueryFilter } from 'mongoose';
import {
  ChildAccountCount,
  ChildEntity,
  ChildRepository,
  CreateChildInput,
  FindManyChildrenOptions,
  UpdateChildInput,
} from '../../contracts/child.contract';
import type { PaginatedResult } from '../../contracts/pagination.contract';
import { escapeRegExp } from '../../utils/escapeRegExp';
import { ChildDocument } from '../../schemas/child.schema';

const mapToChildEntity = (doc: ChildDocument): ChildEntity => ({
  id: doc._id.toString(),
  parentUserId: doc.parentUserId,
  firstName: doc.firstName,
  lastName: doc.lastName,
  age: doc.age,
  gender: doc.gender,
  activeRegistrations: doc.activeRegistrations,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoChildRepository = (model: Model<ChildDocument>): ChildRepository => ({
  findMany: async (options: FindManyChildrenOptions): Promise<PaginatedResult<ChildEntity>> => {
    const { page, pageSize, search, searchField } = options;
    const filter: QueryFilter<ChildDocument> = {};
    if (search && searchField) {
      filter[searchField] = { $regex: escapeRegExp(search), $options: 'i' };
    }

    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).exec(),
      model.countDocuments(filter).exec(),
    ]);

    return { items: docs.map(mapToChildEntity), total, page, pageSize };
  },
  findById: async (id: string): Promise<ChildEntity | null> => {
    const doc = await model.findById(id).exec();
    return doc ? mapToChildEntity(doc) : null;
  },
  findByParentUserId: async (parentUserId: string): Promise<ChildEntity[]> => {
    const docs = await model.find({ parentUserId }).sort({ createdAt: -1 }).exec();
    return docs.map(mapToChildEntity);
  },
  create: async (input: CreateChildInput): Promise<ChildEntity> => {
    const doc = await model.create(input);
    return mapToChildEntity(doc);
  },
  update: async (id: string, input: UpdateChildInput): Promise<ChildEntity | null> => {
    const doc = await model.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    return doc ? mapToChildEntity(doc) : null;
  },
  delete: async (id: string): Promise<boolean> => {
    const result = await model.findByIdAndDelete(id).exec();
    return result !== null;
  },
  countCreatedByDay: async (): Promise<ChildAccountCount[]> => {
    const results = await model
      .aggregate<{ _id: string; count: number }>([
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .exec();
    return results.map((entry) => ({ date: entry._id, count: entry.count }));
  },
});
