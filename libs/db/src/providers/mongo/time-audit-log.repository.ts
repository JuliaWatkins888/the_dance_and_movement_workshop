import type { Model } from 'mongoose';
import {
  CreateTimeAuditLogInput,
  TimeAuditAction,
  TimeAuditLogEntity,
  TimeAuditLogRepository,
  TimeEntrySnapshot,
} from '../../contracts/time-audit-log.contract';
import { TimeAuditLogDocument } from '../../schemas/time-audit-log.schema';

const mapToTimeAuditLogEntity = (doc: TimeAuditLogDocument): TimeAuditLogEntity => ({
  id: doc._id.toString(),
  entryId: doc.entryId,
  userId: doc.userId,
  actorId: doc.actorId,
  action: doc.action as TimeAuditAction,
  before: doc.before as TimeEntrySnapshot | undefined,
  after: doc.after as TimeEntrySnapshot | undefined,
  createdAt: doc.createdAt,
});

export const createMongoTimeAuditLogRepository = (model: Model<TimeAuditLogDocument>): TimeAuditLogRepository => ({
  create: async (input: CreateTimeAuditLogInput): Promise<TimeAuditLogEntity> => {
    // TimeEntrySnapshot is a concrete interface (no index signature), so it isn't structurally
    // assignable to the Mixed-backed `{ [x: string]: unknown }` shape Mongoose's typed create()
    // expects for before/after - this is a type-level cast only, safe at runtime since both are
    // plain JSON-shaped data.
    const doc = await model.create({
      ...input,
      before: input.before as Record<string, unknown> | undefined,
      after: input.after as Record<string, unknown> | undefined,
    });
    return mapToTimeAuditLogEntity(doc);
  },
  findByEntryId: async (entryId: string): Promise<TimeAuditLogEntity[]> => {
    const docs = await model.find({ entryId }).sort({ createdAt: 1 }).exec();
    return docs.map(mapToTimeAuditLogEntity);
  },
  deleteByEntryIds: async (entryIds: string[]): Promise<number> => {
    if (entryIds.length === 0) return 0;
    const result = await model.deleteMany({ entryId: { $in: entryIds } }).exec();
    return result.deletedCount ?? 0;
  },
});
