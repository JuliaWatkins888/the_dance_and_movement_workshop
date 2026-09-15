import mongoose, { Schema, Document, Types } from 'mongoose';

export interface WorkshopOccurrenceSubdocument {
  _id: Types.ObjectId;
  date: Date;
  startTime: string;
  endTime: string;
}

export interface WorkshopDocument extends Document {
  semesterId: string;
  name: string;
  description?: string;
  instructorIds: string[];
  occurrences: WorkshopOccurrenceSubdocument[];
  minAgeYears?: number;
  maxAgeYears?: number;
  priceAmount: number;
  registrationStartDate?: Date;
  capacity: number;
  enrolled: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const workshopOccurrenceSchema = new Schema<WorkshopOccurrenceSubdocument>(
  {
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
  },
  { _id: true },
);

const workshopSchema = new Schema<WorkshopDocument>(
  {
    semesterId: { type: String, required: true, index: true },
    name: { type: String, required: true, index: true },
    description: { type: String, required: false },
    instructorIds: { type: [String], required: true, default: [] },
    occurrences: { type: [workshopOccurrenceSchema], required: true, default: [] },
    minAgeYears: { type: Number, required: false },
    maxAgeYears: { type: Number, required: false },
    priceAmount: { type: Number, required: true },
    registrationStartDate: { type: Date, required: false },
    capacity: { type: Number, required: true },
    enrolled: { type: Number, required: true, default: 0 },
    isPublished: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true },
);

export const WorkshopModel = mongoose.models['Workshop'] || mongoose.model<WorkshopDocument>('Workshop', workshopSchema);
