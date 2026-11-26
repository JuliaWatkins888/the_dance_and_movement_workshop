import mongoose, { Schema, Document } from 'mongoose';
import { PAYMENT_EVENT_STATUSES } from '../contracts/payment-event.contract';
import type { PaymentEventStatus } from '../contracts/payment-event.contract';

export interface PaymentEventDocument extends Document {
  provider: string;
  eventId: string;
  type: string;
  // Absent on events stored before QA-16; those were all claimed and kept, i.e. processed.
  status?: PaymentEventStatus;
  reference?: string;
  orderId?: string;
  error?: string;
  attempts?: number;
  createdAt: Date;
  updatedAt: Date;
}

const paymentEventSchema = new Schema<PaymentEventDocument>(
  {
    provider: { type: String, required: true },
    eventId: { type: String, required: true },
    type: { type: String, required: true },
    status: { type: String, enum: PAYMENT_EVENT_STATUSES },
    reference: { type: String },
    orderId: { type: String },
    error: { type: String },
    attempts: { type: Number },
  },
  { timestamps: true },
);

paymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
paymentEventSchema.index({ updatedAt: -1 });

export const PaymentEventModel =
  mongoose.models['PaymentEvent'] || mongoose.model<PaymentEventDocument>('PaymentEvent', paymentEventSchema);
