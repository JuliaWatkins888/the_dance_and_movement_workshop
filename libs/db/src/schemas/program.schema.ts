import mongoose, { Schema, Document } from 'mongoose';
import type { ProgramBannerConfig, ProgramImageSourceType } from '../contracts/program.contract';

export interface ProgramDocument extends Document {
  name: string;
  slug?: string;
  description?: string;
  minAgeYears?: number;
  maxAgeYears?: number;
  imageUrl?: string;
  imageSourceType?: ProgramImageSourceType;
  imageStorageKey?: string;
  banner?: ProgramBannerConfig;
  order: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const programBannerSchema = new Schema<ProgramBannerConfig>(
  {
    cellSize: { type: Number, required: true },
    variance: { type: Number, required: true },
    xColors: { type: [String], required: true },
    yColors: { type: [String], required: true },
  },
  { _id: false },
);

const programSchema = new Schema<ProgramDocument>(
  {
    name: { type: String, required: true },
    // Sparse so programs saved before slugs existed don't collide on a missing value.
    slug: { type: String, required: false, unique: true, sparse: true },
    description: { type: String, required: false },
    minAgeYears: { type: Number, required: false },
    maxAgeYears: { type: Number, required: false },
    imageUrl: { type: String, required: false },
    imageSourceType: { type: String, enum: ['local', 'external'], required: false },
    imageStorageKey: { type: String, required: false },
    banner: { type: programBannerSchema, required: false },
    order: { type: Number, required: true, default: 0 },
    isPublished: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export const ProgramModel = mongoose.models['Program'] || mongoose.model<ProgramDocument>('Program', programSchema);
