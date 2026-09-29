import mongoose, { Schema, Document } from 'mongoose';
import {
  DISCOUNT_BILLING_TARGETS,
  DISCOUNT_DURATIONS,
  DISCOUNT_KINDS,
  DISCOUNT_SCOPES,
  DiscountBillingTarget,
  DiscountDuration,
  DiscountKind,
  DiscountScope,
  DiscountTarget,
} from '../contracts/discount.contract';

export interface DiscountDocument extends Document {
  code: string;
  description?: string;
  kind: DiscountKind;
  value: number;
  scope: DiscountScope;
  target: DiscountTarget;
  appliesToBilling: DiscountBillingTarget;
  duration: DiscountDuration;
  durationInMonths?: number;
  minSubtotalCents?: number;
  minQuantity?: number;
  startsAt?: Date;
  endsAt?: Date;
  maxRedemptions?: number;
  maxRedemptionsPerUser?: number;
  timesRedeemed: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const targetSchema = new Schema<DiscountTarget>(
  {
    sourceTypes: { type: [String], default: [] },
    sourceIds: { type: [String], default: [] },
    categories: { type: [String], default: [] },
  },
  { _id: false, id: false },
);

const discountSchema = new Schema<DiscountDocument>(
  {
    code: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    description: { type: String, required: false },
    kind: { type: String, enum: DISCOUNT_KINDS, required: true },
    value: { type: Number, required: true, min: 0 },
    scope: { type: String, enum: DISCOUNT_SCOPES, required: true },
    target: { type: targetSchema, default: () => ({}) },
    appliesToBilling: { type: String, enum: DISCOUNT_BILLING_TARGETS, default: 'all' },
    duration: { type: String, enum: DISCOUNT_DURATIONS, default: 'once' },
    durationInMonths: { type: Number, required: false, min: 1 },
    minSubtotalCents: { type: Number, required: false, min: 0 },
    minQuantity: { type: Number, required: false, min: 1 },
    startsAt: { type: Date, required: false },
    endsAt: { type: Date, required: false },
    maxRedemptions: { type: Number, required: false, min: 1 },
    maxRedemptionsPerUser: { type: Number, required: false, min: 1 },
    timesRedeemed: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const DiscountModel = mongoose.models['Discount'] || mongoose.model<DiscountDocument>('Discount', discountSchema);
