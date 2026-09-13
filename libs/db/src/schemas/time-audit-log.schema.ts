import mongoose, { Schema, Document } from 'mongoose';
import { TIME_AUDIT_ACTIONS } from '../contracts/time-audit-log.contract';

export interface TimeAuditLogDocument extends Document {
  entryId: string;
  userId: string;
  actorId: string;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: Date;
}

const timeAuditLogSchema = new Schema<TimeAuditLogDocument>(
  {
    entryId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    actorId: { type: String, required: true },
    action: { type: String, required: true, enum: TIME_AUDIT_ACTIONS },
    before: { type: Schema.Types.Mixed, required: false },
    after: { type: Schema.Types.Mixed, required: false },
  },
  // Append-only log - no updatedAt, nothing ever modifies a row once written.
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const TimeAuditLogModel =
  mongoose.models['TimeAuditLog'] || mongoose.model<TimeAuditLogDocument>('TimeAuditLog', timeAuditLogSchema);
