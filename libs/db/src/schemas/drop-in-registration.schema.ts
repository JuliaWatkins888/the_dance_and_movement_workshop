import mongoose, { Schema, Document } from 'mongoose';
import { DROP_IN_STATUSES } from '../contracts/drop-in-registration.contract';
import type { DropInStatus } from '../contracts/drop-in-registration.contract';
import type { ClassAttendee } from '../contracts/class-registration.contract';

export interface DropInRegistrationDocument extends Document {
  userId: string;
  attendee: ClassAttendee;
  // 'self' or 'child:<id>' - lets the unique index tell dancers apart.
  attendeeKey: string;
  sectionId: string;
  courseId: string;
  schoolYearId: string;
  classDate: Date;
  orderId: string;
  orderLineId: string;
  status: DropInStatus;
  cancelledAt?: Date;
  cancelledByUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const attendeeSchema = new Schema(
  {
    type: { type: String, enum: ['child', 'self'], required: true },
    childId: { type: String, required: false },
    name: { type: String, required: true },
  },
  { _id: false },
);

const dropInRegistrationSchema = new Schema<DropInRegistrationDocument>(
  {
    userId: { type: String, required: true, index: true },
    attendee: { type: attendeeSchema, required: true },
    attendeeKey: { type: String, required: true },
    sectionId: { type: String, required: true },
    courseId: { type: String, required: true },
    schoolYearId: { type: String, required: true },
    classDate: { type: Date, required: true },
    orderId: { type: String, required: true },
    // One drop-in per purchased order line - onPaid can run more than once safely.
    orderLineId: { type: String, required: true, unique: true },
    status: { type: String, enum: DROP_IN_STATUSES, required: true, default: 'active' },
    cancelledAt: { type: Date, required: false },
    cancelledByUserId: { type: String, required: false },
  },
  { timestamps: true },
);

// A dancer holds at most one active drop-in per class date. Cancelled ones don't count, so the
// same dancer can be booked again after a cancellation.
dropInRegistrationSchema.index(
  { sectionId: 1, classDate: 1, userId: 1, attendeeKey: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);

export const DropInRegistrationModel =
  mongoose.models['DropInRegistration'] ||
  mongoose.model<DropInRegistrationDocument>('DropInRegistration', dropInRegistrationSchema);

export interface DropInSeatDocument extends Document {
  sectionId: string;
  classDate: Date;
  held: number;
}

// Seats held per section and date, including checkouts still awaiting payment.
const dropInSeatSchema = new Schema<DropInSeatDocument>({
  sectionId: { type: String, required: true },
  classDate: { type: Date, required: true },
  held: { type: Number, required: true, default: 0, min: 0 },
});

dropInSeatSchema.index({ sectionId: 1, classDate: 1 }, { unique: true });

export const DropInSeatModel = mongoose.models['DropInSeat'] || mongoose.model<DropInSeatDocument>('DropInSeat', dropInSeatSchema);
