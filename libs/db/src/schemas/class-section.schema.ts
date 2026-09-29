import mongoose, { Schema, Document } from 'mongoose';
import { DAYS_OF_WEEK } from '../contracts/class-section.contract';
import type { DayOfWeek } from '../contracts/class-section.contract';

export interface ClassSectionDocument extends Document {
  courseId: string;
  schoolYearId: string;
  semesterIds: string[];
  instructorStaffIds: string[];
  daysOfWeek: DayOfWeek[];
  startTime: string;
  endTime: string;
  capacity: number;
  enrolled: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const classSectionSchema = new Schema<ClassSectionDocument>(
  {
    courseId: { type: String, required: true, index: true },
    schoolYearId: { type: String, required: true, index: true },
    semesterIds: { type: [String], required: true, default: [] },
    instructorStaffIds: { type: [String], required: true, default: [] },
    daysOfWeek: { type: [String], required: true, enum: DAYS_OF_WEEK, default: [] },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    capacity: { type: Number, required: true },
    enrolled: { type: Number, required: true, default: 0 },
    isPublished: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export const ClassSectionModel =
  mongoose.models['ClassSection'] || mongoose.model<ClassSectionDocument>('ClassSection', classSectionSchema);
