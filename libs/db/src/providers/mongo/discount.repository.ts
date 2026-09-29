import { isValidObjectId } from 'mongoose';
import type { Model, QueryFilter } from 'mongoose';
import {
  CreateDiscountInput,
  DiscountEntity,
  DiscountRepository,
  FindManyDiscountsOptions,
  UpdateDiscountInput,
} from '../../contracts/discount.contract';
import type { PaginatedResult } from '../../contracts/pagination.contract';
import { toUpdateOperations } from '../../utils/toUpdateOperations';
import { escapeRegExp } from '../../utils/escapeRegExp';
import { DiscountDocument } from '../../schemas/discount.schema';

const mapToDiscountEntity = (doc: DiscountDocument): DiscountEntity => {
  const plain = doc.toObject();
  return {
    id: doc._id.toString(),
    code: plain.code,
    description: plain.description,
    kind: plain.kind,
    value: plain.value,
    scope: plain.scope,
    target: {
      sourceTypes: plain.target?.sourceTypes ?? [],
      sourceIds: plain.target?.sourceIds ?? [],
      categories: plain.target?.categories ?? [],
    },
    appliesToBilling: plain.appliesToBilling,
    duration: plain.duration,
    durationInMonths: plain.durationInMonths,
    minSubtotalCents: plain.minSubtotalCents,
    minQuantity: plain.minQuantity,
    startsAt: plain.startsAt,
    endsAt: plain.endsAt,
    maxRedemptions: plain.maxRedemptions,
    maxRedemptionsPerUser: plain.maxRedemptionsPerUser,
    timesRedeemed: plain.timesRedeemed ?? 0,
    isActive: plain.isActive,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

export const createMongoDiscountRepository = (model: Model<DiscountDocument>): DiscountRepository => ({
  findMany: async (options: FindManyDiscountsOptions): Promise<PaginatedResult<DiscountEntity>> => {
    const { page, pageSize, search, searchField } = options;
    const filter: QueryFilter<DiscountDocument> = {};
    if (search && searchField) {
      filter[searchField] = { $regex: escapeRegExp(search), $options: 'i' };
    }

    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).exec(),
      model.countDocuments(filter).exec(),
    ]);

    return { items: docs.map(mapToDiscountEntity), total, page, pageSize };
  },
  findById: async (id: string): Promise<DiscountEntity | null> => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapToDiscountEntity(doc) : null;
  },
  findByCode: async (code: string): Promise<DiscountEntity | null> => {
    const doc = await model.findOne({ code: code.trim().toUpperCase() }).exec();
    return doc ? mapToDiscountEntity(doc) : null;
  },
  create: async (input: CreateDiscountInput): Promise<DiscountEntity> => {
    const doc = await model.create(input);
    return mapToDiscountEntity(doc);
  },
  update: async (id: string, input: UpdateDiscountInput): Promise<DiscountEntity | null> => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findByIdAndUpdate(id, toUpdateOperations(input), { new: true, runValidators: true }).exec();
    return doc ? mapToDiscountEntity(doc) : null;
  },
  delete: async (id: string): Promise<boolean> => {
    if (!isValidObjectId(id)) return false;
    const result = await model.findByIdAndDelete(id).exec();
    return result !== null;
  },
  incrementRedemptions: async (id: string): Promise<boolean> => {
    if (!isValidObjectId(id)) return false;
    const result = await model
      .updateOne(
        {
          _id: id,
          $or: [{ maxRedemptions: { $exists: false } }, { maxRedemptions: null }, { $expr: { $lt: ['$timesRedeemed', '$maxRedemptions'] } }],
        },
        { $inc: { timesRedeemed: 1 } },
      )
      .exec();
    return result.modifiedCount === 1;
  },
});
