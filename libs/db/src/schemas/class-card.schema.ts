import mongoose, { Schema, Document } from 'mongoose';
import { CLASS_CARD_REDEMPTION_STATUSES, CLASS_CARD_STATUSES } from '../contracts/class-card.contract';
import type { ClassCardRedemptionStatus, ClassCardStatus } from '../contracts/class-card.contract';
import type { ClassAttendee } from '../contracts/class-registration.contract';

const attendeeSchema = new Schema(
  {
    type: { type: String, enum: ['child', 'self'], required: true },
    childId: { type: String, required: false },
    name: { type: String, required: true },
  },
  { _id: false },
);

export interface ClassCardTypeDocument extends Document {
  name: string;
  classCount: number;
  priceCents: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const classCardTypeSchema = new Schema<ClassCardTypeDocument>(
  {
    name: { type: String, required: true, trim: true },
    classCount: { type: Number, required: true, min: 1 },
    priceCents: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export const ClassCardTypeModel =
  mongoose.models['ClassCardType'] || mongoose.model<ClassCardTypeDocument>('ClassCardType', classCardTypeSchema);

export interface ClassCardDocument extends Document {
  userId: string;
  attendee: ClassAttendee;
  cardTypeId: string;
  name: string;
  classesTotal: number;
  classesUsed: number;
  orderId: string;
  orderLineId: string;
  status: ClassCardStatus;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const classCardSchema = new Schema<ClassCardDocument>(
  {
    userId: { type: String, required: true, index: true },
    attendee: { type: attendeeSchema, required: true },
    cardTypeId: { type: String, required: true },
    name: { type: String, required: true },
    classesTotal: { type: Number, required: true, min: 1 },
    classesUsed: { type: Number, required: true, default: 0, min: 0 },
    orderId: { type: String, required: true },
    // One card per purchased order line - onPaid can run more than once safely.
    orderLineId: { type: String, required: true, unique: true },
    status: { type: String, enum: CLASS_CARD_STATUSES, required: true, default: 'active' },
    cancelledAt: { type: Date, required: false },
  },
  { timestamps: true },
);

classCardSchema.index({ status: 1 });

export const ClassCardModel = mongoose.models['ClassCard'] || mongoose.model<ClassCardDocument>('ClassCard', classCardSchema);

export interface ClassCardRedemptionDocument extends Document {
  cardId: string;
  userId: string;
  attendee: ClassAttendee;
  // 'self' or 'child:<id>' - lets the unique index tell dancers apart.
  attendeeKey: string;
  sectionId: string;
  courseId: string;
  classDate: Date;
  redeemedByUserId: string;
  status: ClassCardRedemptionStatus;
  voidedAt?: Date;
  voidedByUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const classCardRedemptionSchema = new Schema<ClassCardRedemptionDocument>(
  {
    cardId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    attendee: { type: attendeeSchema, required: true },
    attendeeKey: { type: String, required: true },
    sectionId: { type: String, required: true },
    courseId: { type: String, required: true },
    classDate: { type: Date, required: true },
    redeemedByUserId: { type: String, required: true },
    status: { type: String, enum: CLASS_CARD_REDEMPTION_STATUSES, required: true, default: 'active' },
    voidedAt: { type: Date, required: false },
    voidedByUserId: { type: String, required: false },
  },
  { timestamps: true },
);

// Stops a double tap: a dancer is checked in with a card at most once per class date, whichever of
// their cards is used. Voided check-ins don't count, so undo then redo works.
classCardRedemptionSchema.index(
  { sectionId: 1, classDate: 1, userId: 1, attendeeKey: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);

export const ClassCardRedemptionModel =
  mongoose.models['ClassCardRedemption'] ||
  mongoose.model<ClassCardRedemptionDocument>('ClassCardRedemption', classCardRedemptionSchema);
