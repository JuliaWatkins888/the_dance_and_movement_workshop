import mongoose, { Schema, Document } from 'mongoose';
import { GALLERY_IMAGE_SOURCE_TYPES, GalleryImageSourceType } from '../contracts/gallery-image.contract';

export interface GalleryImageDocument extends Document {
  title: string;
  description?: string;
  altText?: string;
  metadata?: Record<string, unknown>;
  sourceType: GalleryImageSourceType;
  url: string;
  assetId?: string;
  storageKey?: string;
  isPublished: boolean;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const galleryImageSchema = new Schema<GalleryImageDocument>(
  {
    title: { type: String, required: true },
    description: { type: String, required: false },
    altText: { type: String, required: false },
    metadata: { type: Schema.Types.Mixed, required: false },
    sourceType: { type: String, enum: GALLERY_IMAGE_SOURCE_TYPES, required: true },
    url: { type: String, required: true },
    assetId: { type: String, required: false },
    storageKey: { type: String, required: false },
    isPublished: { type: Boolean, required: true, default: false, index: true },
    uploadedBy: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

export const GalleryImageModel =
  mongoose.models['GalleryImage'] || mongoose.model<GalleryImageDocument>('GalleryImage', galleryImageSchema);
