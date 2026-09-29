import mongoose, { Schema, Document } from 'mongoose';
import { BILLING_INTERVALS, ProductBilling } from '../contracts/commerce.contract';
import {
  PRODUCT_IMAGE_SOURCE_TYPES,
  ProductImageSourceType,
  ProductOption,
  ProductVariant,
} from '../contracts/product.contract';

export interface ProductDocument extends Document {
  name: string;
  slug: string;
  description?: string;
  categories: string[];
  imageUrl?: string;
  imageSourceType?: ProductImageSourceType;
  imageAssetId?: string;
  imageStorageKey?: string;
  basePriceCents: number;
  taxCode?: string;
  requiresShipping: boolean;
  billing: ProductBilling;
  options: ProductOption[];
  variants: ProductVariant[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const optionSchema = new Schema<ProductOption>(
  {
    name: { type: String, required: true },
    values: { type: [String], default: [] },
  },
  { _id: false, id: false },
);

const variantSchema = new Schema<ProductVariant>(
  {
    id: { type: String, required: true },
    sku: { type: String, required: false },
    optionValues: { type: Schema.Types.Mixed, default: {} },
    priceCents: { type: Number, required: false, min: 0 },
    stockQuantity: { type: Number, default: null, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false, id: false, minimize: false },
);

const billingSchema = new Schema(
  {
    type: { type: String, enum: ['one_time', 'recurring'], required: true, default: 'one_time' },
    interval: { type: String, enum: BILLING_INTERVALS, required: false },
    intervalCount: { type: Number, required: false, min: 1 },
  },
  { _id: false, id: false },
);

const productSchema = new Schema<ProductDocument>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, required: false },
    categories: { type: [String], default: [], index: true },
    imageUrl: { type: String, required: false },
    imageSourceType: { type: String, enum: PRODUCT_IMAGE_SOURCE_TYPES, required: false },
    imageAssetId: { type: String, required: false },
    imageStorageKey: { type: String, required: false },
    basePriceCents: { type: Number, required: true, min: 0 },
    taxCode: { type: String, required: false },
    requiresShipping: { type: Boolean, default: false },
    billing: { type: billingSchema, default: () => ({ type: 'one_time' }) },
    options: { type: [optionSchema], default: [] },
    variants: { type: [variantSchema], default: [] },
    isPublished: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

export const ProductModel = mongoose.models['Product'] || mongoose.model<ProductDocument>('Product', productSchema);
