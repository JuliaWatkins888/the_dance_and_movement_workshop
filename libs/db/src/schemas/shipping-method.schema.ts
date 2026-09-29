import mongoose, { Schema, Document } from 'mongoose';

export interface ShippingMethodDocument extends Document {
  name: string;
  description?: string;
  amountCents: number;
  freeOverCents?: number;
  requiresAddress: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const shippingMethodSchema = new Schema<ShippingMethodDocument>(
  {
    name: { type: String, required: true },
    description: { type: String, required: false },
    amountCents: { type: Number, required: true, min: 0 },
    freeOverCents: { type: Number, required: false, min: 0 },
    requiresAddress: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const ShippingMethodModel =
  mongoose.models['ShippingMethod'] || mongoose.model<ShippingMethodDocument>('ShippingMethod', shippingMethodSchema);
