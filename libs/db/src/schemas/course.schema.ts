import mongoose, { Schema, Document } from 'mongoose';
import { COURSE_LEVELS } from '../contracts/course.contract';
import type { CourseLevel } from '../contracts/course.contract';

export interface CourseDocument extends Document {
  programId: string;
  name: string;
  slug: string;
  description?: string;
  dressCode?: string;
  styles: string[];
  level?: CourseLevel;
  minAgeYears?: number;
  maxAgeYears?: number;
  monthlyPriceCents: number;
  order: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new Schema<CourseDocument>(
  {
    programId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: false },
    dressCode: { type: String, required: false },
    styles: { type: [String], required: true, default: [] },
    level: { type: String, required: false, enum: COURSE_LEVELS },
    minAgeYears: { type: Number, required: false },
    maxAgeYears: { type: Number, required: false },
    monthlyPriceCents: { type: Number, required: true },
    order: { type: Number, required: true, default: 0 },
    isPublished: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export const CourseModel = mongoose.models['Course'] || mongoose.model<CourseDocument>('Course', courseSchema);
