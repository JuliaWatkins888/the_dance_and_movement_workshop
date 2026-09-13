import mongoose, { Schema, Document } from 'mongoose';

export interface TimeEntryTypeDocument extends Document {
  label: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const timeEntryTypeSchema = new Schema<TimeEntryTypeDocument>(
  {
    label: { type: String, required: true, unique: true },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const TimeEntryTypeModel =
  mongoose.models['TimeEntryType'] || mongoose.model<TimeEntryTypeDocument>('TimeEntryType', timeEntryTypeSchema);
