import mongoose, { Schema, Document } from 'mongoose';

export interface TimeEntryDocument extends Document {
  userId: string;
  typeId: string;
  startAt: Date;
  endAt?: Date;
  locked: boolean;
  autoClosed: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const timeEntrySchema = new Schema<TimeEntryDocument>(
  {
    // Compound index (not a unique one - unlike staff.schema.ts's userId - since an employee has
    // many entries over time) supporting this plugin's two most common queries: "this employee's
    // entries in a date range" and "does this employee already have an open entry".
    userId: { type: String, required: true, index: true },
    typeId: { type: String, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: false },
    locked: { type: Boolean, required: true, default: false },
    autoClosed: { type: Boolean, required: true, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

timeEntrySchema.index({ userId: 1, startAt: 1 });

export const TimeEntryModel =
  mongoose.models['TimeEntry'] || mongoose.model<TimeEntryDocument>('TimeEntry', timeEntrySchema);
