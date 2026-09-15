import mongoose, { Schema, Document } from 'mongoose';
import { COURSE_IMAGE_SOURCE_TYPES, CourseImageSourceType } from '../contracts/course.contract';

export interface CourseDocument extends Document {
  semesterId: string;
  name: string;
  description?: string;
  categories: string[];
  imageUrl?: string;
  imageSourceType?: CourseImageSourceType;
  imageAssetId?: string;
  imageStorageKey?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new Schema<CourseDocument>(
  {
    semesterId: { type: String, required: true, index: true },
    name: { type: String, required: true, index: true },
    description: { type: String, required: false },
    categories: { type: [String], required: true, default: [], index: true },
    imageUrl: { type: String, required: false },
    imageSourceType: { type: String, enum: COURSE_IMAGE_SOURCE_TYPES, required: false },
    imageAssetId: { type: String, required: false },
    imageStorageKey: { type: String, required: false },
    isPublished: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true },
);

export const CourseModel = mongoose.models['Course'] || mongoose.model<CourseDocument>('Course', courseSchema);
