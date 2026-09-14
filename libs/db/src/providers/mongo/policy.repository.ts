import type { Model } from 'mongoose';
import {
  CreatePolicyCategoryInput,
  CreatePolicyItemInput,
  PolicyCategoryEntity,
  PolicyItemEntity,
  PolicyRepository,
  UpdatePolicyCategoryInput,
  UpdatePolicyItemInput,
} from '../../contracts/policy.contract';
import { PolicyCategoryDocument, PolicyItemSubdocument } from '../../schemas/policy.schema';

const mapToPolicyItemEntity = (item: PolicyItemSubdocument): PolicyItemEntity => ({
  id: item._id.toString(),
  title: item.title,
  content: item.content,
  order: item.order,
});

const mapToPolicyCategoryEntity = (doc: PolicyCategoryDocument): PolicyCategoryEntity => ({
  id: doc._id.toString(),
  title: doc.title,
  icon: doc.icon,
  order: doc.order,
  // Sorted here rather than in the query - Mongo has no server-side way to sort the elements
  // within a single array field, only whole documents.
  items: [...doc.items].sort((a, b) => a.order - b.order).map(mapToPolicyItemEntity),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoPolicyRepository = (model: Model<PolicyCategoryDocument>): PolicyRepository => ({
  findAll: async (): Promise<PolicyCategoryEntity[]> => {
    const docs = await model.find().sort({ order: 1, createdAt: 1 }).exec();
    return docs.map(mapToPolicyCategoryEntity);
  },
  findCategoryById: async (id: string): Promise<PolicyCategoryEntity | null> => {
    const doc = await model.findById(id).exec();
    return doc ? mapToPolicyCategoryEntity(doc) : null;
  },
  createCategory: async (input: CreatePolicyCategoryInput): Promise<PolicyCategoryEntity> => {
    const doc = await model.create({ title: input.title, icon: input.icon, order: input.order ?? 0, items: [] });
    return mapToPolicyCategoryEntity(doc);
  },
  updateCategory: async (id: string, input: UpdatePolicyCategoryInput): Promise<PolicyCategoryEntity | null> => {
    const doc = await model.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    return doc ? mapToPolicyCategoryEntity(doc) : null;
  },
  deleteCategory: async (id: string): Promise<boolean> => {
    const result = await model.findByIdAndDelete(id).exec();
    return result !== null;
  },
  createItem: async (categoryId: string, input: CreatePolicyItemInput): Promise<PolicyCategoryEntity | null> => {
    const doc = await model
      .findByIdAndUpdate(
        categoryId,
        { $push: { items: { title: input.title, content: input.content, order: input.order ?? 0 } } },
        { new: true, runValidators: true },
      )
      .exec();
    return doc ? mapToPolicyCategoryEntity(doc) : null;
  },
  updateItem: async (
    categoryId: string,
    itemId: string,
    input: UpdatePolicyItemInput,
  ): Promise<PolicyCategoryEntity | null> => {
    const setFields: Record<string, unknown> = {};
    if (input.title !== undefined) setFields['items.$[item].title'] = input.title;
    if (input.content !== undefined) setFields['items.$[item].content'] = input.content;
    if (input.order !== undefined) setFields['items.$[item].order'] = input.order;

    if (Object.keys(setFields).length === 0) {
      const unchanged = await model.findById(categoryId).exec();
      return unchanged ? mapToPolicyCategoryEntity(unchanged) : null;
    }

    const doc = await model
      .findOneAndUpdate(
        { _id: categoryId, 'items._id': itemId },
        { $set: setFields },
        { new: true, runValidators: true, arrayFilters: [{ 'item._id': itemId }] },
      )
      .exec();
    return doc ? mapToPolicyCategoryEntity(doc) : null;
  },
  deleteItem: async (categoryId: string, itemId: string): Promise<PolicyCategoryEntity | null> => {
    const doc = await model
      .findByIdAndUpdate(categoryId, { $pull: { items: { _id: itemId } } }, { new: true })
      .exec();
    return doc ? mapToPolicyCategoryEntity(doc) : null;
  },
});
