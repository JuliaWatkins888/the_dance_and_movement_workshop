import mongoose, { Schema, Document } from 'mongoose';

export interface AssetDocument extends Document {
  publicUrl: string;
  providerKey: string;
  variants?: Record<string, string>;
  altText?: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  purpose: string;
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<AssetDocument>(
  {
    publicUrl: { type: String, required: true },
    // Indexed - not queried by anything in this pass, but a realistic future lookup key (e.g. a
    // delete-by-key admin tool) and cheap to add now.
    providerKey: { type: String, required: true, index: true },
    variants: { type: Schema.Types.Mixed, required: false },
    altText: { type: String, required: false },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    uploadedBy: { type: String, required: true, index: true },
    purpose: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

export const AssetModel = mongoose.models['Asset'] || mongoose.model<AssetDocument>('Asset', assetSchema);
