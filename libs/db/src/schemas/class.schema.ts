import mongoose, { Schema, Document } from 'mongoose';
import { DAYS_OF_WEEK } from '../contracts/class.contract';
import type { DayOfWeek } from '../contracts/class.contract';

export interface ClassDocument extends Document {
  courseId: string;
  semesterIds: string[];
  variantLabel?: string;
  instructorIds: string[];
  daysOfWeek: DayOfWeek[];
  startTime: string;
  endTime: string;
  registrationStartDate?: Date;
  startDate: Date;
  endDate: Date;
  minAgeYears?: number;
  maxAgeYears?: number;
  priceAmount: number;
  capacity: number;
  enrolled: number;
  copiedFromId?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const classSchema = new Schema<ClassDocument>(
  {
    courseId: { type: String, required: true, index: true },
    semesterIds: { type: [String], required: true, default: [], index: true },
    variantLabel: { type: String, required: false, index: true },
    instructorIds: { type: [String], required: true, default: [] },
    daysOfWeek: { type: [String], required: true, enum: DAYS_OF_WEEK, default: [], index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    registrationStartDate: { type: Date, required: false },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    minAgeYears: { type: Number, required: false },
    maxAgeYears: { type: Number, required: false },
    priceAmount: { type: Number, required: true },
    capacity: { type: Number, required: true },
    enrolled: { type: Number, required: true, default: 0 },
    copiedFromId: { type: String, required: false, index: true },
    isPublished: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true },
);

export const ClassModel = mongoose.models['Class'] || mongoose.model<ClassDocument>('Class', classSchema);
