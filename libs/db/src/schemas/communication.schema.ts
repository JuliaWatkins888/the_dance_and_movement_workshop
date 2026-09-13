import mongoose, { Schema, Document, Types } from 'mongoose';

export interface CommunicationMessageDocument extends Document {
  _id: Types.ObjectId;
  authorRole: 'submitter' | 'admin';
  authorUserId: string;
  authorName: string;
  body: string;
  createdAt: Date;
}

// Only `createdAt` is spec'd per message (no `updatedAt`) - set explicitly rather than via
// schema-level `timestamps`, which would add both. Mirrors blog-post.schema.ts's commentSchema.
const communicationMessageSchema = new Schema<CommunicationMessageDocument>({
  authorRole: { type: String, required: true, enum: ['submitter', 'admin'] },
  authorUserId: { type: String, required: true },
  authorName: { type: String, required: true },
  body: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now },
});

export interface CommunicationDocument extends Document {
  submitterUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  messages: Types.DocumentArray<CommunicationMessageDocument>;
  createdAt: Date;
  updatedAt: Date;
}

const communicationSchema = new Schema<CommunicationDocument>(
  {
    submitterUserId: { type: String, required: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, required: true },
    messages: { type: [communicationMessageSchema], required: true, default: [] },
  },
  { timestamps: true }
);

// 'Communication' pluralizes to the 'communications' collection.
export const CommunicationModel =
  mongoose.models['Communication'] || mongoose.model<CommunicationDocument>('Communication', communicationSchema);
