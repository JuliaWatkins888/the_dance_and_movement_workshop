import mongoose, { Schema, Document } from 'mongoose';
import { BILLING_INTERVALS, BillingInterval } from '../contracts/commerce.contract';
import {
  BILLING_SUBSCRIPTION_LINE_STATUSES,
  BILLING_SUBSCRIPTION_STATUSES,
  BillingSubscriptionLine,
  BillingSubscriptionStatus,
} from '../contracts/billing-subscription.contract';

export interface BillingSubscriptionDocument extends Document {
  userId: string;
  orderId: string;
  currency: string;
  provider: string;
  providerSubscriptionId: string;
  status: BillingSubscriptionStatus;
  interval: BillingInterval;
  intervalCount: number;
  currentPeriodEnd?: Date;
  endsAt?: Date;
  lines: BillingSubscriptionLine[];
  canceledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const lineSchema = new Schema<BillingSubscriptionLine>(
  {
    id: { type: String, required: true },
    orderLineId: { type: String, required: true },
    sourceType: { type: String, required: true },
    sourceId: { type: String, required: true },
    variantId: { type: String, required: false },
    options: { type: Schema.Types.Mixed, default: {} },
    name: { type: String, required: true },
    unitAmountCents: { type: Number, required: true },
    quantity: { type: Number, required: true },
    providerItemId: { type: String, required: true },
    status: { type: String, enum: BILLING_SUBSCRIPTION_LINE_STATUSES, default: 'active' },
    removedAt: { type: Date, required: false },
  },
  { _id: false, id: false, minimize: false },
);

const billingSubscriptionSchema = new Schema<BillingSubscriptionDocument>(
  {
    userId: { type: String, required: true, index: true },
    orderId: { type: String, required: true },
    currency: { type: String, required: true },
    provider: { type: String, required: true },
    providerSubscriptionId: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: BILLING_SUBSCRIPTION_STATUSES, required: true, index: true },
    interval: { type: String, enum: BILLING_INTERVALS, required: true },
    intervalCount: { type: Number, required: true, min: 1 },
    currentPeriodEnd: { type: Date, required: false },
    endsAt: { type: Date, required: false },
    lines: { type: [lineSchema], default: [] },
    canceledAt: { type: Date, required: false },
  },
  { timestamps: true },
);

billingSubscriptionSchema.index({ userId: 1, 'lines.sourceType': 1, 'lines.sourceId': 1 });

export const BillingSubscriptionModel =
  mongoose.models['BillingSubscription'] ||
  mongoose.model<BillingSubscriptionDocument>('BillingSubscription', billingSubscriptionSchema);
