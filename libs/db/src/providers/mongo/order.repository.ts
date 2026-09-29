import { isValidObjectId } from 'mongoose';
import type { Model, QueryFilter } from 'mongoose';
import {
  CreateOrderInput,
  FindManyOrdersOptions,
  FindOrdersForExportOptions,
  OrderEntity,
  OrderRepository,
  OrderStatus,
  OrderStatusChange,
  SalesAggregationOptions,
  SalesBucket,
  SalesTotals,
  UpdateOrderInput,
} from '../../contracts/order.contract';
import type { PaginatedResult } from '../../contracts/pagination.contract';
import { OrderDocument } from '../../schemas/order.schema';

// Statuses that mean a code was actually used - a failed or still-pending checkout never counts
// against a per-user redemption limit.
const REDEEMED_STATUSES: OrderStatus[] = ['paid', 'fulfilled', 'cancelled', 'refunded'];

// What counts as revenue: paid and not since cancelled or refunded.
const REVENUE_STATUSES: OrderStatus[] = ['paid', 'fulfilled'];

const revenueMatch = (from: Date, to: Date) => ({ status: { $in: REVENUE_STATUSES }, paidAt: { $gte: from, $lt: to } });

const mapToOrderEntity = (doc: OrderDocument): OrderEntity => {
  const plain = doc.toObject();
  return {
    id: doc._id.toString(),
    userId: plain.userId,
    kind: plain.kind,
    status: plain.status,
    currency: plain.currency,
    lines: plain.lines ?? [],
    totals: plain.totals,
    discount: plain.discount ?? undefined,
    shipping: plain.shipping ?? undefined,
    shippingAddress: plain.shippingAddress ?? undefined,
    billingAddress: plain.billingAddress ?? undefined,
    payment: plain.payment,
    subscriptionIds: plain.subscriptionIds ?? [],
    fulfillmentErrors: plain.fulfillmentErrors ?? [],
    statusHistory: plain.statusHistory ?? [],
    internalNotes: plain.internalNotes,
    trackingNumber: plain.trackingNumber,
    createdByUserId: plain.createdByUserId,
    paidAt: plain.paidAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

export const createMongoOrderRepository = (model: Model<OrderDocument>): OrderRepository => ({
  findMany: async (options: FindManyOrdersOptions): Promise<PaginatedResult<OrderEntity>> => {
    const { page, pageSize, status, kind, userId, from, to } = options;
    const filter: QueryFilter<OrderDocument> = {};
    if (status) filter.status = status;
    if (kind) filter.kind = kind;
    if (userId) filter.userId = userId;
    if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lt: to } : {}) };

    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).exec(),
      model.countDocuments(filter).exec(),
    ]);

    return { items: docs.map(mapToOrderEntity), total, page, pageSize };
  },
  findById: async (id: string): Promise<OrderEntity | null> => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapToOrderEntity(doc) : null;
  },
  findByPaymentId: async (paymentId: string): Promise<OrderEntity | null> => {
    const doc = await model.findOne({ 'payment.paymentId': paymentId }).exec();
    return doc ? mapToOrderEntity(doc) : null;
  },
  findByInvoiceId: async (invoiceId: string): Promise<OrderEntity | null> => {
    const doc = await model.findOne({ 'payment.invoiceId': invoiceId }).exec();
    return doc ? mapToOrderEntity(doc) : null;
  },
  findPendingCreatedBefore: async (cutoff: Date): Promise<OrderEntity[]> => {
    const docs = await model.find({ status: 'pending', createdAt: { $lt: cutoff } }).exec();
    return docs.map(mapToOrderEntity);
  },
  countRedemptionsByUser: (userId: string, discountId: string): Promise<number> =>
    model
      .countDocuments({ userId, kind: { $in: ['checkout', 'manual'] }, 'discount.discountId': discountId, status: { $in: REDEEMED_STATUSES } })
      .exec(),
  findForExport: async ({ from, to, status }: FindOrdersForExportOptions): Promise<OrderEntity[]> => {
    const filter: QueryFilter<OrderDocument> = { createdAt: { $gte: from, $lt: to } };
    if (status) filter.status = status;
    const docs = await model.find(filter).sort({ createdAt: 1 }).exec();
    return docs.map(mapToOrderEntity);
  },
  aggregateSales: async ({ from, to, unit, timezone }: SalesAggregationOptions): Promise<SalesBucket[]> => {
    const rows: { _id: string; revenueCents: number; orderCount: number }[] = await model
      .aggregate([
        { $match: revenueMatch(from, to) },
        {
          $group: {
            _id: { $dateToString: { date: '$paidAt', format: unit === 'day' ? '%Y-%m-%d' : '%Y-%m', timezone } },
            revenueCents: { $sum: '$totals.totalCents' },
            orderCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .exec();
    return rows.map((row) => ({ label: row._id, revenueCents: row.revenueCents, orderCount: row.orderCount }));
  },
  sumSales: async (from: Date, to: Date): Promise<SalesTotals> => {
    const [row]: { revenueCents: number; orderCount: number }[] = await model
      .aggregate([
        { $match: revenueMatch(from, to) },
        { $group: { _id: null, revenueCents: { $sum: '$totals.totalCents' }, orderCount: { $sum: 1 } } },
      ])
      .exec();
    return { revenueCents: row?.revenueCents ?? 0, orderCount: row?.orderCount ?? 0 };
  },
  countAwaitingFulfillment: (): Promise<number> =>
    model.countDocuments({ status: 'paid', lines: { $elemMatch: { requiresShipping: true } } }).exec(),
  create: async (input: CreateOrderInput): Promise<OrderEntity> => {
    const doc = await model.create(input);
    return mapToOrderEntity(doc);
  },
  update: async (id: string, input: UpdateOrderInput): Promise<OrderEntity | null> => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findByIdAndUpdate(id, { $set: input }, { new: true }).exec();
    return doc ? mapToOrderEntity(doc) : null;
  },
  transitionStatus: async (id: string, from: OrderStatus[], change: OrderStatusChange): Promise<OrderEntity | null> => {
    if (!isValidObjectId(id)) return null;
    const set: Record<string, unknown> = { status: change.status };
    if (change.status === 'paid') set['paidAt'] = change.at;
    const doc = await model
      .findOneAndUpdate({ _id: id, status: { $in: from } }, { $set: set, $push: { statusHistory: change } }, { new: true })
      .exec();
    return doc ? mapToOrderEntity(doc) : null;
  },
});
