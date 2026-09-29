import mongoose, { Schema, Document } from 'mongoose';
import { PostalAddress } from '../contracts/commerce.contract';
import {
  ORDER_KINDS,
  ORDER_STATUSES,
  OrderDiscountSnapshot,
  OrderKind,
  OrderLine,
  OrderPaymentInfo,
  OrderShippingSnapshot,
  OrderStatus,
  OrderStatusChange,
  OrderTotals,
} from '../contracts/order.contract';

export interface OrderDocument extends Document {
  userId: string;
  kind: OrderKind;
  status: OrderStatus;
  currency: string;
  lines: OrderLine[];
  totals: OrderTotals;
  discount?: OrderDiscountSnapshot;
  shipping?: OrderShippingSnapshot;
  shippingAddress?: PostalAddress;
  billingAddress?: PostalAddress;
  payment: OrderPaymentInfo;
  subscriptionIds: string[];
  fulfillmentErrors: string[];
  statusHistory: OrderStatusChange[];
  internalNotes?: string;
  trackingNumber?: string;
  createdByUserId?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Order lines and their billing snapshot are write-once history, never queried by field, so they
// stay schemaless beyond the handful of top-level fields indexes/filters need.
const orderSchema = new Schema<OrderDocument>(
  {
    userId: { type: String, required: true, index: true },
    kind: { type: String, enum: ORDER_KINDS, required: true },
    status: { type: String, enum: ORDER_STATUSES, required: true, index: true },
    currency: { type: String, required: true },
    lines: { type: Schema.Types.Mixed, default: () => [] },
    totals: { type: Schema.Types.Mixed, required: true },
    discount: { type: Schema.Types.Mixed, required: false },
    shipping: { type: Schema.Types.Mixed, required: false },
    shippingAddress: { type: Schema.Types.Mixed, required: false },
    billingAddress: { type: Schema.Types.Mixed, required: false },
    payment: { type: Schema.Types.Mixed, required: true },
    subscriptionIds: { type: [String], default: [] },
    fulfillmentErrors: { type: [String], default: [] },
    statusHistory: { type: Schema.Types.Mixed, default: () => [] },
    internalNotes: { type: String, required: false },
    trackingNumber: { type: String, required: false },
    createdByUserId: { type: String, required: false },
    paidAt: { type: Date, required: false, index: true },
  },
  { timestamps: true, minimize: false },
);

orderSchema.index({ 'payment.paymentId': 1 }, { sparse: true });
orderSchema.index({ 'payment.invoiceId': 1 }, { sparse: true });
orderSchema.index({ userId: 1, 'discount.discountId': 1 });

export const OrderModel = mongoose.models['Order'] || mongoose.model<OrderDocument>('Order', orderSchema);
