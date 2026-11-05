import mongoose, { Schema, Document } from 'mongoose';
import { POLICY_CONSENT_METHODS } from '../contracts/policy-consent.contract';
import type { PolicyConsentMethod, PolicySnapshotCategory } from '../contracts/policy-consent.contract';

export interface PolicyConsentDocument extends Document {
  userId: string;
  schoolYearId: string | null;
  schoolYearName?: string;
  policyVersionHash: string;
  policySnapshot: PolicySnapshotCategory[];
  signedName: string;
  agreedAt: Date;
  method: PolicyConsentMethod;
  ipAddress?: string;
  userAgent?: string;
  recordedByUserId?: string;
  recordedByName?: string;
  orderId?: string;
  createdAt: Date;
}

const policySnapshotItemSchema = new Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
  },
  { _id: false },
);

const policySnapshotCategorySchema = new Schema(
  {
    title: { type: String, required: true },
    items: { type: [policySnapshotItemSchema], default: [] },
  },
  { _id: false },
);

const policyConsentSchema = new Schema<PolicyConsentDocument>(
  {
    userId: { type: String, required: true },
    schoolYearId: { type: String, default: null },
    schoolYearName: { type: String, required: false },
    policyVersionHash: { type: String, required: true },
    policySnapshot: { type: [policySnapshotCategorySchema], required: true },
    signedName: { type: String, required: true },
    agreedAt: { type: Date, required: true },
    method: { type: String, enum: POLICY_CONSENT_METHODS, required: true },
    ipAddress: { type: String, required: false },
    userAgent: { type: String, required: false },
    recordedByUserId: { type: String, required: false },
    recordedByName: { type: String, required: false },
    orderId: { type: String, required: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

policyConsentSchema.index({ userId: 1, policyVersionHash: 1 });
policyConsentSchema.index({ userId: 1, agreedAt: -1 });

export const PolicyConsentModel =
  mongoose.models['PolicyConsent'] || mongoose.model<PolicyConsentDocument>('PolicyConsent', policyConsentSchema);
