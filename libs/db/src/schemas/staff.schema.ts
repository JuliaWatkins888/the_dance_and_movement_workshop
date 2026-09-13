import mongoose, { Schema, Document } from 'mongoose';
import { STAFF_PHOTO_SOURCE_TYPES, StaffPhotoSourceType } from '../contracts/staff.contract';

export interface StaffDocument extends Document {
  userId: string;
  title: string;
  bio?: string;
  photoUrl?: string;
  photoSourceType?: StaffPhotoSourceType;
  photoAssetId?: string;
  photoStorageKey?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const staffSchema = new Schema<StaffDocument>(
  {
    // unique: one staff record per user account - enforced here (not just in the route layer) so
    // a race between two concurrent "link this user" requests can't create duplicates.
    userId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    bio: { type: String, required: false },
    photoUrl: { type: String, required: false },
    photoSourceType: { type: String, enum: STAFF_PHOTO_SOURCE_TYPES, required: false },
    photoAssetId: { type: String, required: false },
    photoStorageKey: { type: String, required: false },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export const StaffModel = mongoose.models['Staff'] || mongoose.model<StaffDocument>('Staff', staffSchema);
