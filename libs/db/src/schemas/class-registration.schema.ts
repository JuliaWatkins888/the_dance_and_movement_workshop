import mongoose, { Schema, Document } from 'mongoose';
import { CLASS_REGISTRATION_STATUSES } from '../contracts/class-registration.contract';
import type { ClassAttendee, ClassRegistrationStatus } from '../contracts/class-registration.contract';
import type { ClassPlanKind } from '../utils/class-pricing';

export interface ClassRegistrationDocument extends Document {
  userId: string;
  attendee: ClassAttendee;
  sectionId: string;
  courseId: string;
  schoolYearId: string;
  plan: ClassPlanKind;
  semesterId?: string;
  startsAt: Date;
  endsAt: Date;
  orderId: string;
  orderLineId: string;
  subscriptionId?: string;
  subscriptionLineId?: string;
  status: ClassRegistrationStatus;
  withdrawnAt?: Date;
  accessEndsAt?: Date;
  seatReleased: boolean;
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

const classRegistrationSchema = new Schema<ClassRegistrationDocument>(
  {
    userId: { type: String, required: true, index: true },
    attendee: { type: attendeeSchema, required: true },
    sectionId: { type: String, required: true, index: true },
    courseId: { type: String, required: true },
    schoolYearId: { type: String, required: true },
    plan: { type: String, enum: ['monthly', 'semester', 'year'], required: true },
    semesterId: { type: String, required: false },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    orderId: { type: String, required: true },
    // One registration per purchased order line - onPaid can run more than once safely.
    orderLineId: { type: String, required: true, unique: true },
    subscriptionId: { type: String, required: false },
    subscriptionLineId: { type: String, required: false },
    status: { type: String, enum: CLASS_REGISTRATION_STATUSES, required: true, default: 'active' },
    withdrawnAt: { type: Date, required: false },
    accessEndsAt: { type: Date, required: false },
    seatReleased: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

export const ClassRegistrationModel =
  mongoose.models['ClassRegistration'] ||
  mongoose.model<ClassRegistrationDocument>('ClassRegistration', classRegistrationSchema);
