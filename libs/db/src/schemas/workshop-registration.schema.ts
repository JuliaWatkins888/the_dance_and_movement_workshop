import mongoose, { Schema, Document } from 'mongoose';
import type { ClassAttendee } from '../contracts/class-registration.contract';

export interface WorkshopRegistrationDocument extends Document {
  userId: string;
  attendee: ClassAttendee;
  workshopId: string;
  dayIds: string[];
  isFullWorkshop: boolean;
  orderId: string;
  orderLineId: string;
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

const workshopRegistrationSchema = new Schema<WorkshopRegistrationDocument>(
  {
    userId: { type: String, required: true, index: true },
    attendee: { type: attendeeSchema, required: true },
    workshopId: { type: String, required: true, index: true },
    dayIds: { type: [String], required: true, default: [] },
    isFullWorkshop: { type: Boolean, required: true, default: false },
    orderId: { type: String, required: true },
    // One registration per purchased order line - onPaid can run more than once safely.
    orderLineId: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export const WorkshopRegistrationModel =
  mongoose.models['WorkshopRegistration'] ||
  mongoose.model<WorkshopRegistrationDocument>('WorkshopRegistration', workshopRegistrationSchema);
