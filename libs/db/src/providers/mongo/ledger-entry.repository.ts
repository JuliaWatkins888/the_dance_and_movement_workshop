import { isValidObjectId } from 'mongoose';
import type { Model, QueryFilter } from 'mongoose';
import type {
  CreateLedgerEntryInput,
  FindLedgerPaymentsOptions,
  LedgerEntryEntity,
  LedgerEntryRepository,
  LedgerUserBalance,
  VoidLedgerEntryInput,
} from '../../contracts/ledger-entry.contract';
import type { PaginatedResult } from '../../contracts/pagination.contract';
import type { LedgerEntryDocument } from '../../schemas/ledger-entry.schema';

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000;

const mapToLedgerEntryEntity = (doc: LedgerEntryDocument): LedgerEntryEntity => ({
  id: doc._id.toString(),
  userId: doc.userId,
  kind: doc.kind,
  amountCents: doc.amountCents,
  description: doc.description,
  ...(doc.category ? { category: doc.category } : {}),
  ...(doc.studentId ? { studentId: doc.studentId } : {}),
  ...(doc.dueDate ? { dueDate: doc.dueDate } : {}),
  ...(doc.method ? { method: doc.method } : {}),
  ...(doc.checkNumber ? { checkNumber: doc.checkNumber } : {}),
  ...(doc.receivedAt ? { receivedAt: doc.receivedAt } : {}),
  ...(doc.appliesTo.length > 0
    ? { appliesTo: doc.appliesTo.map((allocation) => ({ chargeId: allocation.chargeId, amountCents: allocation.amountCents })) }
    : {}),
  ...(doc.note ? { note: doc.note } : {}),
  source: doc.source,
  ...(doc.orderId ? { orderId: doc.orderId } : {}),
  ...(doc.subscriptionId ? { subscriptionId: doc.subscriptionId } : {}),
  ...(doc.registrationId ? { registrationId: doc.registrationId } : {}),
  ...(doc.billingMonth ? { billingMonth: doc.billingMonth } : {}),
  ...(doc.privateLessonId ? { privateLessonId: doc.privateLessonId } : {}),
  ...(doc.lessonDate ? { lessonDate: doc.lessonDate } : {}),
  ...(doc.createdByUserId ? { createdByUserId: doc.createdByUserId } : {}),
  ...(doc.voidedAt ? { voidedAt: doc.voidedAt } : {}),
  ...(doc.voidedByUserId ? { voidedByUserId: doc.voidedByUserId } : {}),
  ...(doc.voidReason ? { voidReason: doc.voidReason } : {}),
  createdAt: doc.createdAt,
});

// Matches computeBalance in utils/ledger.ts: charges minus payments, skipping voided entries
// (`voidedAt: null` also matches the field being absent).
const balanceStages = (match: Record<string, unknown>) => [
  { $match: { ...match, voidedAt: null } },
  {
    $group: {
      _id: '$userId',
      balanceCents: { $sum: { $cond: [{ $eq: ['$kind', 'charge'] }, '$amountCents', { $multiply: ['$amountCents', -1] }] } },
    },
  },
];

const toUserBalance = (row: { _id: string; balanceCents: number }): LedgerUserBalance => ({
  userId: row._id,
  balanceCents: row.balanceCents,
});

export const createMongoLedgerEntryRepository = (model: Model<LedgerEntryDocument>): LedgerEntryRepository => ({
  create: async (input: CreateLedgerEntryInput): Promise<LedgerEntryEntity> => mapToLedgerEntryEntity(await model.create(input)),

  findBilledMonths: async (registrationId: string): Promise<string[]> => {
    const docs = await model.find({ registrationId, billingMonth: { $type: 'string' } }, { billingMonth: 1 }).lean<{ billingMonth: string }[]>().exec();
    return docs.map((doc) => doc.billingMonth);
  },

  createTuitionCharge: async (input) => {
    try {
      return mapToLedgerEntryEntity(await model.create(input));
    } catch (error) {
      if (isDuplicateKeyError(error)) return null;
      throw error;
    }
  },

  findBilledLessonDates: async (privateLessonId: string): Promise<string[]> => {
    const docs = await model.find({ privateLessonId, lessonDate: { $type: 'string' } }, { lessonDate: 1 }).lean<{ lessonDate: string }[]>().exec();
    return docs.map((doc) => doc.lessonDate);
  },

  createPrivateLessonCharge: async (input) => {
    try {
      return mapToLedgerEntryEntity(await model.create(input));
    } catch (error) {
      if (isDuplicateKeyError(error)) return null;
      throw error;
    }
  },

  findById: async (id: string): Promise<LedgerEntryEntity | null> => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapToLedgerEntryEntity(doc) : null;
  },

  findByUserId: async (userId: string, { page, pageSize }: { page: number; pageSize: number }): Promise<PaginatedResult<LedgerEntryEntity>> => {
    const [docs, total] = await Promise.all([
      model
        .find({ userId })
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      model.countDocuments({ userId }).exec(),
    ]);
    return { items: docs.map(mapToLedgerEntryEntity), total, page, pageSize };
  },

  findAllByUserId: async (userId: string): Promise<LedgerEntryEntity[]> => {
    const docs = await model.find({ userId }).sort({ createdAt: 1, _id: 1 }).exec();
    return docs.map(mapToLedgerEntryEntity);
  },

  findByOrderId: async (orderId: string): Promise<LedgerEntryEntity[]> => {
    const docs = await model.find({ orderId }).sort({ createdAt: 1, _id: 1 }).exec();
    return docs.map(mapToLedgerEntryEntity);
  },

  findPaymentsForExport: async ({ from, to, method }: FindLedgerPaymentsOptions): Promise<LedgerEntryEntity[]> => {
    const filter: QueryFilter<LedgerEntryDocument> = {
      kind: 'payment',
      voidedAt: null,
      receivedAt: { $gte: from, $lt: to },
      ...(method ? { method } : {}),
    };
    const docs = await model.find(filter).sort({ receivedAt: 1, _id: 1 }).exec();
    return docs.map(mapToLedgerEntryEntity);
  },

  findOutstandingBalances: async (limit: number): Promise<LedgerUserBalance[]> => {
    const rows = await model
      .aggregate<{ _id: string; balanceCents: number }>([
        ...balanceStages({}),
        { $match: { balanceCents: { $gt: 0 } } },
        { $sort: { balanceCents: -1, _id: 1 } },
        { $limit: limit },
      ])
      .exec();
    return rows.map(toUserBalance);
  },

  findBalancesByUserIds: async (userIds: string[]): Promise<LedgerUserBalance[]> => {
    const rows = await model.aggregate<{ _id: string; balanceCents: number }>(balanceStages({ userId: { $in: userIds } })).exec();
    return rows.map(toUserBalance);
  },

  void: async (id: string, input: VoidLedgerEntryInput): Promise<LedgerEntryEntity | null> => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findOneAndUpdate({ _id: id, voidedAt: null }, { $set: input }, { new: true }).exec();
    return doc ? mapToLedgerEntryEntity(doc) : null;
  },
});
