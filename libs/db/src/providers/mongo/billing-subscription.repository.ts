import { isValidObjectId } from 'mongoose';
import type { Model, QueryFilter } from 'mongoose';
import {
  BillingSubscriptionEntity,
  BillingSubscriptionLine,
  BillingSubscriptionRepository,
  CreateBillingSubscriptionInput,
  FindManyBillingSubscriptionsOptions,
  UpdateBillingSubscriptionInput,
} from '../../contracts/billing-subscription.contract';
import type { PaginatedResult } from '../../contracts/pagination.contract';
import { BillingSubscriptionDocument } from '../../schemas/billing-subscription.schema';

const mapToBillingSubscriptionEntity = (doc: BillingSubscriptionDocument): BillingSubscriptionEntity => {
  const plain = doc.toObject();
  return {
    id: doc._id.toString(),
    userId: plain.userId,
    orderId: plain.orderId,
    currency: plain.currency,
    provider: plain.provider,
    providerSubscriptionId: plain.providerSubscriptionId,
    status: plain.status,
    interval: plain.interval,
    intervalCount: plain.intervalCount,
    currentPeriodEnd: plain.currentPeriodEnd,
    endsAt: plain.endsAt,
    lines: ((plain.lines ?? []) as BillingSubscriptionLine[]).map((line) => ({
      id: line.id,
      orderLineId: line.orderLineId,
      sourceType: line.sourceType,
      sourceId: line.sourceId,
      variantId: line.variantId,
      options: line.options ?? {},
      name: line.name,
      unitAmountCents: line.unitAmountCents,
      quantity: line.quantity,
      providerItemId: line.providerItemId,
      status: line.status,
      removedAt: line.removedAt,
    })),
    canceledAt: plain.canceledAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

export const createMongoBillingSubscriptionRepository = (
  model: Model<BillingSubscriptionDocument>,
): BillingSubscriptionRepository => ({
  findMany: async (options: FindManyBillingSubscriptionsOptions): Promise<PaginatedResult<BillingSubscriptionEntity>> => {
    const { page, pageSize, status, userId } = options;
    const filter: QueryFilter<BillingSubscriptionDocument> = {};
    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).exec(),
      model.countDocuments(filter).exec(),
    ]);

    return { items: docs.map(mapToBillingSubscriptionEntity), total, page, pageSize };
  },
  findByUserId: async (userId: string): Promise<BillingSubscriptionEntity[]> => {
    const docs = await model.find({ userId }).sort({ createdAt: -1 }).exec();
    return docs.map(mapToBillingSubscriptionEntity);
  },
  findById: async (id: string): Promise<BillingSubscriptionEntity | null> => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapToBillingSubscriptionEntity(doc) : null;
  },
  findByProviderSubscriptionId: async (providerSubscriptionId: string): Promise<BillingSubscriptionEntity | null> => {
    const doc = await model.findOne({ providerSubscriptionId }).exec();
    return doc ? mapToBillingSubscriptionEntity(doc) : null;
  },
  findLiveByUserAndSource: async (userId: string, sourceType: string, sourceId: string): Promise<BillingSubscriptionEntity[]> => {
    const docs = await model
      .find({
        userId,
        status: { $in: ['active', 'past_due'] },
        lines: { $elemMatch: { sourceType, sourceId, status: 'active' } },
      })
      .exec();
    return docs.map(mapToBillingSubscriptionEntity);
  },
  create: async (input: CreateBillingSubscriptionInput): Promise<BillingSubscriptionEntity> => {
    const doc = await model.create(input);
    return mapToBillingSubscriptionEntity(doc);
  },
  update: async (id: string, input: UpdateBillingSubscriptionInput): Promise<BillingSubscriptionEntity | null> => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    return doc ? mapToBillingSubscriptionEntity(doc) : null;
  },
});
