import mongoose, { Schema, Document } from 'mongoose';

export interface HolidayOpeningDocument extends Document {
  date: Date;
  holidayKey: string;
  createdAt: Date;
}

const holidayOpeningSchema = new Schema<HolidayOpeningDocument>(
  {
    date: { type: Date, required: true, unique: true },
    holidayKey: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const HolidayOpeningModel =
  mongoose.models['HolidayOpening'] || mongoose.model<HolidayOpeningDocument>('HolidayOpening', holidayOpeningSchema);
