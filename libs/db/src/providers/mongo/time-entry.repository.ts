import type { Model, QueryFilter } from 'mongoose';
import {
  CreateTimeEntryInput,
  DeleteInRangeResult,
  FindEntriesForUsersInRangeOptions,
  FindEntriesInRangeOptions,
  TimeEntryEntity,
  TimeEntryRepository,
  UpdateTimeEntryInput,
} from '../../contracts/time-entry.contract';
import { TimeEntryDocument } from '../../schemas/time-entry.schema';

// Used only as an upper bound in findOverlapping's range comparison below - an open entry (no
// real endAt yet) is otherwise unbounded, and there is no date value that safely means "forever"
// to Mongo's own range operators without one.
const FAR_FUTURE_SENTINEL = new Date('9999-12-31T23:59:59.999Z');

const mapToTimeEntryEntity = (doc: TimeEntryDocument): TimeEntryEntity => ({
  id: doc._id.toString(),
  userId: doc.userId,
  typeId: doc.typeId,
  startAt: doc.startAt,
  endAt: doc.endAt,
  locked: doc.locked,
  autoClosed: doc.autoClosed,
  createdBy: doc.createdBy,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoTimeEntryRepository = (model: Model<TimeEntryDocument>): TimeEntryRepository => ({
  findById: async (id: string): Promise<TimeEntryEntity | null> => {
    const doc = await model.findById(id).exec();
    return doc ? mapToTimeEntryEntity(doc) : null;
  },
  findOpenByUserId: async (userId: string): Promise<TimeEntryEntity | null> => {
    const doc = await model.findOne({ userId, endAt: { $exists: false } }).exec();
    return doc ? mapToTimeEntryEntity(doc) : null;
  },
  findManyInRange: async (options: FindEntriesInRangeOptions): Promise<TimeEntryEntity[]> => {
    const { userId, from, to } = options;
    const docs = await model
      .find({ userId, startAt: { $gte: from, $lt: to } })
      .sort({ startAt: 1 })
      .exec();
    return docs.map(mapToTimeEntryEntity);
  },
  findManyForUsersInRange: async (options: FindEntriesForUsersInRangeOptions): Promise<TimeEntryEntity[]> => {
    const { userIds, from, to } = options;
    const docs = await model
      .find({ userId: { $in: userIds }, startAt: { $gte: from, $lt: to } })
      .sort({ userId: 1, startAt: 1 })
      .exec();
    return docs.map(mapToTimeEntryEntity);
  },
  findOverlapping: async (
    userId: string,
    startAt: Date,
    endAt: Date | undefined,
    excludeId?: string,
  ): Promise<TimeEntryEntity[]> => {
    const filter: QueryFilter<TimeEntryDocument> = {
      userId,
      startAt: { $lt: endAt ?? FAR_FUTURE_SENTINEL },
      $or: [{ endAt: { $exists: false } }, { endAt: { $gt: startAt } }],
    };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    const docs = await model.find(filter).exec();
    return docs.map(mapToTimeEntryEntity);
  },
  countByTypeId: async (typeId: string): Promise<number> => model.countDocuments({ typeId }).exec(),
  create: async (input: CreateTimeEntryInput): Promise<TimeEntryEntity> => {
    const doc = await model.create(input);
    return mapToTimeEntryEntity(doc);
  },
  update: async (id: string, input: UpdateTimeEntryInput): Promise<TimeEntryEntity | null> => {
    const doc = await model.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    return doc ? mapToTimeEntryEntity(doc) : null;
  },
  delete: async (id: string): Promise<boolean> => {
    const result = await model.findByIdAndDelete(id).exec();
    return result !== null;
  },
  deleteInRange: async (from: Date, to: Date): Promise<DeleteInRangeResult> => {
    const docs = await model.find({ startAt: { $gte: from, $lt: to } }).select('_id').exec();
    const deletedIds = docs.map((doc) => doc._id.toString());
    if (deletedIds.length === 0) {
      return { deletedCount: 0, deletedIds: [] };
    }
    await model.deleteMany({ _id: { $in: deletedIds } }).exec();
    return { deletedCount: deletedIds.length, deletedIds };
  },
});
