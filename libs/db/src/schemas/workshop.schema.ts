import mongoose, { Schema, Document, Types } from 'mongoose';
import { COURSE_LEVELS } from '../contracts/course.contract';
import type { CourseLevel } from '../contracts/course.contract';
import { WORKSHOP_IMAGE_SOURCE_TYPES } from '../contracts/workshop.contract';
import type { WorkshopBannerConfig, WorkshopImageSourceType } from '../contracts/workshop.contract';

export interface WorkshopDayDocument {
  _id: Types.ObjectId;
  date: Date;
  startTime: string;
  endTime: string;
  startsAt: Date;
  endsAt: Date;
  agenda?: string;
  capacity: number;
  enrolled: number;
}

// Flat rather than a discriminated union - `type` decides which fields are meaningful.
export interface WorkshopInstructorDocument {
  type: 'staff' | 'guest';
  staffId?: string;
  name?: string;
  bio?: string;
  photoUrl?: string;
  photoSourceType?: WorkshopImageSourceType;
  photoAssetId?: string;
}

export interface WorkshopDocument extends Document {
  title: string;
  slug: string;
  description?: string;
  dressCode?: string;
  styles: string[];
  level?: CourseLevel;
  minAgeYears?: number;
  maxAgeYears?: number;
  instructors: WorkshopInstructorDocument[];
  days: WorkshopDayDocument[];
  pricePerDayCents: number;
  fullWorkshopDiscountPercent: number;
  imageUrl?: string;
  imageSourceType?: WorkshopImageSourceType;
  imageAssetId?: string;
  banner?: WorkshopBannerConfig;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const workshopDaySchema = new Schema<WorkshopDayDocument>({
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  agenda: { type: String, required: false },
  capacity: { type: Number, required: true },
  enrolled: { type: Number, required: true, default: 0 },
});

const workshopInstructorSchema = new Schema<WorkshopInstructorDocument>(
  {
    type: { type: String, enum: ['staff', 'guest'], required: true },
    staffId: { type: String, required: false },
    name: { type: String, required: false },
    bio: { type: String, required: false },
    photoUrl: { type: String, required: false },
    photoSourceType: {
      type: String,
      enum: WORKSHOP_IMAGE_SOURCE_TYPES,
      required: false,
    },
    photoAssetId: { type: String, required: false },
  },
  { _id: false },
);

const workshopBannerSchema = new Schema<WorkshopBannerConfig>(
  {
    cellSize: { type: Number, required: true },
    variance: { type: Number, required: true },
    xColors: { type: [String], required: true },
    yColors: { type: [String], required: true },
  },
  { _id: false },
);

const workshopSchema = new Schema<WorkshopDocument>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: false },
    dressCode: { type: String, required: false },
    styles: { type: [String], required: true, default: [] },
    level: { type: String, required: false, enum: COURSE_LEVELS },
    minAgeYears: { type: Number, required: false },
    maxAgeYears: { type: Number, required: false },
    instructors: {
      type: [workshopInstructorSchema],
      required: true,
      default: [],
    },
    days: { type: [workshopDaySchema], required: true, default: [] },
    pricePerDayCents: { type: Number, required: true },
    fullWorkshopDiscountPercent: { type: Number, required: true, default: 0 },
    imageUrl: { type: String, required: false },
    imageSourceType: {
      type: String,
      enum: WORKSHOP_IMAGE_SOURCE_TYPES,
      required: false,
    },
    imageAssetId: { type: String, required: false },
    banner: { type: workshopBannerSchema, required: false },
    isPublished: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export const WorkshopModel = mongoose.models['Workshop'] || mongoose.model<WorkshopDocument>('Workshop', workshopSchema);
