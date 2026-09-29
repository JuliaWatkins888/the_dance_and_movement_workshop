import mongoose, { Schema, Document } from 'mongoose';

export interface PaymentCustomerDocument extends Document {
  userId: string;
  provider: string;
  providerCustomerId: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentCustomerSchema = new Schema<PaymentCustomerDocument>(
  {
    userId: { type: String, required: true },
    provider: { type: String, required: true },
    providerCustomerId: { type: String, required: true },
  },
  { timestamps: true },
);

// One customer per user per provider - enforced here so two concurrent first checkouts can't
// create duplicate provider customers that later split a user's saved payment methods.
paymentCustomerSchema.index({ userId: 1, provider: 1 }, { unique: true });

export const PaymentCustomerModel =
  mongoose.models['PaymentCustomer'] ||
  mongoose.model<PaymentCustomerDocument>('PaymentCustomer', paymentCustomerSchema);
