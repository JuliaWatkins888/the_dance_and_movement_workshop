import mongoose, { Schema, Document } from 'mongoose';
import { DAYS_OF_WEEK } from '../contracts/class.contract';
import type { DayOfWeek } from '../contracts/class.contract';

export interface ClassDocument extends Document {
  name: string;
  description?: string;
  categories: string[];
  instructors: string[];
  daysOfWeek: DayOfWeek[];
  startTime: string;
  endTime: string;
  session: string;
  registrationStartDate?: Date;
  startDate: Date;
  endDate: Date;
  minAgeYears?: number;
  maxAgeYears?: number;
  priceAmount: number;
  billingCycle: string;
  capacity: number;
  enrolled: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const classSchema = new Schema<ClassDocument>(
  {
    name: { type: String, required: true, index: true },
    description: { type: String, required: false },
    categories: { type: [String], required: true, default: [], index: true },
    instructors: { type: [String], required: true, default: [] },
    daysOfWeek: { type: [String], required: true, enum: DAYS_OF_WEEK, default: [], index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    session: { type: String, required: true },
    registrationStartDate: { type: Date, required: false },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    minAgeYears: { type: Number, required: false },
    maxAgeYears: { type: Number, required: false },
    priceAmount: { type: Number, required: true },
    billingCycle: { type: String, required: true, default: 'Monthly' },
    capacity: { type: Number, required: true },
    enrolled: { type: Number, required: true, default: 0 },
    isPublished: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true },
);

export const ClassModel = mongoose.models['Class'] || mongoose.model<ClassDocument>('Class', classSchema);
