import mongoose, { Schema, Document } from 'mongoose';

export interface PaymentEventDocument extends Document {
  provider: string;
  eventId: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentEventSchema = new Schema<PaymentEventDocument>(
  {
    provider: { type: String, required: true },
    eventId: { type: String, required: true },
    type: { type: String, required: true },
  },
  { timestamps: true },
);

paymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export const PaymentEventModel =
  mongoose.models['PaymentEvent'] || mongoose.model<PaymentEventDocument>('PaymentEvent', paymentEventSchema);
