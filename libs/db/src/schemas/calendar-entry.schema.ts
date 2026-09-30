import mongoose, { Schema, Document } from 'mongoose';

export interface CalendarEntryDocument extends Document {
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  startTime?: string;
  endTime?: string;
  isStudioClosed: boolean;
  isAtStudio: boolean;
  venueName?: string;
  venueAddress?: string;
  linkUrl?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const calendarEntrySchema = new Schema<CalendarEntryDocument>(
  {
    title: { type: String, required: true },
    description: { type: String, required: false },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true, index: true },
    startTime: { type: String, required: false },
    endTime: { type: String, required: false },
    isStudioClosed: { type: Boolean, required: true, default: false },
    isAtStudio: { type: Boolean, required: true, default: true },
    venueName: { type: String, required: false },
    venueAddress: { type: String, required: false },
    linkUrl: { type: String, required: false },
    isPublished: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export const CalendarEntryModel =
  mongoose.models['CalendarEntry'] || mongoose.model<CalendarEntryDocument>('CalendarEntry', calendarEntrySchema);
