import type { Model, QueryFilter } from 'mongoose';
import type {
  FindManyPaymentEventsOptions,
  PaymentEventEntity,
  PaymentEventOutcome,
  PaymentEventRepository,
  PaymentEventStatus,
} from '../../contracts/payment-event.contract';
import type { PaginatedResult } from '../../contracts/pagination.contract';
import type { PaymentEventDocument } from '../../schemas/payment-event.schema';

const DUPLICATE_KEY_ERROR = 11000;
const REJECTED_EVENT_ID = '__rejected_signature__';
const MAX_ERROR_LENGTH = 500;

// Records stored before statuses existed were only ever kept once claimed, so they read as processed.
const statusFilter = (status: PaymentEventStatus): QueryFilter<PaymentEventDocument> =>
  status === 'processed' ? { status: { $in: ['processed', null] } } : { status };

const mapToPaymentEventEntity = (doc: PaymentEventDocument): PaymentEventEntity => ({
  id: doc._id.toString(),
  provider: doc.provider,
  eventId: doc.eventId,
  type: doc.type,
  status: doc.status ?? 'processed',
  ...(doc.reference ? { reference: doc.reference } : {}),
  ...(doc.orderId ? { orderId: doc.orderId } : {}),
  ...(doc.error ? { error: doc.error } : {}),
  ...(doc.attempts !== undefined ? { attempts: doc.attempts } : {}),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoPaymentEventRepository = (model: Model<PaymentEventDocument>): PaymentEventRepository => ({
  claim: async (provider: string, eventId: string, type: string): Promise<boolean> => {
    try {
      await model.create({ provider, eventId, type, status: 'processing' });
      return true;
    } catch (error) {
      if ((error as { code?: number }).code !== DUPLICATE_KEY_ERROR) throw error;
      // Compare-and-set, so two concurrent retries of a failed event can't both reclaim it.
      const reclaimed = await model
        .findOneAndUpdate({ provider, eventId, status: 'failed' }, { $set: { status: 'processing' }, $unset: { error: 1 } })
        .exec();
      return reclaimed !== null;
    }
  },
  markProcessed: async (provider: string, eventId: string, outcome: PaymentEventOutcome): Promise<void> => {
    await model
      .updateOne(
        { provider, eventId },
        {
          $set: {
            status: 'processed',
            ...(outcome.reference ? { reference: outcome.reference } : {}),
            ...(outcome.orderId ? { orderId: outcome.orderId } : {}),
          },
          $unset: { error: 1 },
        },
      )
      .exec();
  },
  markFailed: async (provider: string, eventId: string, error: string): Promise<void> => {
    await model.updateOne({ provider, eventId }, { $set: { status: 'failed', error: error.slice(0, MAX_ERROR_LENGTH) } }).exec();
  },
  recordRejected: async (provider: string): Promise<void> => {
    await model
      .updateOne(
        { provider, eventId: REJECTED_EVENT_ID },
        { $set: { type: 'invalid_signature', status: 'rejected' }, $inc: { attempts: 1 } },
        { upsert: true },
      )
      .exec();
  },
  findMany: async ({ page, pageSize, status }: FindManyPaymentEventsOptions): Promise<PaginatedResult<PaymentEventEntity>> => {
    const filter = status ? statusFilter(status) : {};
    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      model.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(pageSize).exec(),
      model.countDocuments(filter).exec(),
    ]);
    return { items: docs.map(mapToPaymentEventEntity), total, page, pageSize };
  },
  findLatestVerified: async (provider: string): Promise<PaymentEventEntity | null> => {
    const doc = await model.findOne({ provider, status: { $ne: 'rejected' } }).sort({ createdAt: -1 }).exec();
    return doc ? mapToPaymentEventEntity(doc) : null;
  },
  findRejected: async (provider: string): Promise<PaymentEventEntity | null> => {
    const doc = await model.findOne({ provider, eventId: REJECTED_EVENT_ID }).exec();
    return doc ? mapToPaymentEventEntity(doc) : null;
  },
  countByStatusSince: (provider: string, status: PaymentEventStatus, since: Date): Promise<number> =>
    model.countDocuments({ provider, ...statusFilter(status), updatedAt: { $gte: since } }).exec(),
});
