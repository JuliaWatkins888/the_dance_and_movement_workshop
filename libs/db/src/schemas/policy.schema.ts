import mongoose, { Schema, Document, Types } from 'mongoose';

export interface PolicyItemSubdocument {
  _id: Types.ObjectId;
  title: string;
  content: string;
  order: number;
}

export interface PolicyCategoryDocument extends Document {
  title: string;
  icon?: string;
  order: number;
  items: PolicyItemSubdocument[];
  createdAt: Date;
  updatedAt: Date;
}

const policyItemSchema = new Schema<PolicyItemSubdocument>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    order: { type: Number, required: true, default: 0 },
  },
  { _id: true },
);

const policyCategorySchema = new Schema<PolicyCategoryDocument>(
  {
    title: { type: String, required: true },
    icon: { type: String, required: false },
    order: { type: Number, required: true, default: 0 },
    items: { type: [policyItemSchema], default: [] },
  },
  { timestamps: true },
);

export const PolicyCategoryModel =
  mongoose.models['PolicyCategory'] || mongoose.model<PolicyCategoryDocument>('PolicyCategory', policyCategorySchema);
