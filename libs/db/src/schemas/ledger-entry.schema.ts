import mongoose, { Schema, Document } from 'mongoose';
import {
  LEDGER_CHARGE_CATEGORIES,
  LEDGER_ENTRY_KINDS,
  LEDGER_ENTRY_SOURCES,
  LEDGER_PAYMENT_METHODS,
} from '../contracts/ledger-entry.contract';
import type {
  LedgerAllocation,
  LedgerChargeCategory,
  LedgerEntryKind,
  LedgerEntrySource,
  LedgerPaymentMethod,
} from '../contracts/ledger-entry.contract';

export interface LedgerEntryDocument extends Document {
  userId: string;
  kind: LedgerEntryKind;
  amountCents: number;
  description: string;
  category?: LedgerChargeCategory;
  studentId?: string;
  dueDate?: Date;
  method?: LedgerPaymentMethod;
  checkNumber?: string;
  receivedAt?: Date;
  appliesTo: LedgerAllocation[];
  note?: string;
  source: LedgerEntrySource;
  orderId?: string;
  subscriptionId?: string;
  registrationId?: string;
  billingMonth?: string;
  createdByUserId?: string;
  voidedAt?: Date;
  voidedByUserId?: string;
  voidReason?: string;
  createdAt: Date;
}

const ledgerAllocationSchema = new Schema(
  {
    chargeId: { type: String, required: true },
    amountCents: { type: Number, required: true },
  },
  { _id: false },
);

const ledgerEntrySchema = new Schema<LedgerEntryDocument>(
  {
    userId: { type: String, required: true },
    kind: { type: String, enum: LEDGER_ENTRY_KINDS, required: true },
    amountCents: { type: Number, required: true },
    description: { type: String, required: true },
    category: { type: String, enum: LEDGER_CHARGE_CATEGORIES, required: false },
    studentId: { type: String, required: false },
    dueDate: { type: Date, required: false },
    method: { type: String, enum: LEDGER_PAYMENT_METHODS, required: false },
    checkNumber: { type: String, required: false },
    receivedAt: { type: Date, required: false },
    appliesTo: { type: [ledgerAllocationSchema], default: [] },
    note: { type: String, required: false },
    source: { type: String, enum: LEDGER_ENTRY_SOURCES, required: true },
    orderId: { type: String, required: false },
    subscriptionId: { type: String, required: false },
    registrationId: { type: String, required: false },
    billingMonth: { type: String, required: false },
    createdByUserId: { type: String, required: false },
    voidedAt: { type: Date, required: false },
    voidedByUserId: { type: String, required: false },
    voidReason: { type: String, required: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ledgerEntrySchema.index({ userId: 1, createdAt: -1 });
ledgerEntrySchema.index({ orderId: 1 });
ledgerEntrySchema.index({ kind: 1, receivedAt: 1 });
ledgerEntrySchema.index(
  { registrationId: 1, billingMonth: 1 },
  { unique: true, partialFilterExpression: { registrationId: { $type: 'string' }, billingMonth: { $type: 'string' } } },
);

export const LedgerEntryModel =
  mongoose.models['LedgerEntry'] || mongoose.model<LedgerEntryDocument>('LedgerEntry', ledgerEntrySchema);
