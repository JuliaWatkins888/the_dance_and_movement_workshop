import mongoose, { Schema, Document } from 'mongoose';
import { CartLine } from '../contracts/cart.contract';

export interface CartDocument extends Document {
  userId: string;
  lines: CartLine[];
  discountCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const cartLineSchema = new Schema<CartLine>(
  {
    id: { type: String, required: true },
    sourceType: { type: String, required: true },
    sourceId: { type: String, required: true },
    variantId: { type: String, required: false },
    options: { type: Schema.Types.Mixed, default: {} },
    quantity: { type: Number, required: true, min: 1 },
    addedAt: { type: Date, required: true },
  },
  { _id: false, id: false, minimize: false },
);

const cartSchema = new Schema<CartDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    lines: { type: [cartLineSchema], default: [] },
    discountCode: { type: String, default: null },
  },
  { timestamps: true },
);

export const CartModel = mongoose.models['Cart'] || mongoose.model<CartDocument>('Cart', cartSchema);
