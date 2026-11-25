import mongoose, { Schema, Document } from 'mongoose';
import { DAYS_OF_WEEK } from '../contracts/class-section.contract';
import { PRIVATE_LESSON_EXCEPTION_KINDS, PRIVATE_LESSON_STATUSES } from '../contracts/private-lesson.contract';
import type { ClassAttendee } from '../contracts/class-registration.contract';
import type { DayOfWeek } from '../contracts/class-section.contract';
import type { PrivateLessonExceptionKind, PrivateLessonStatus } from '../contracts/private-lesson.contract';

const attendeeSchema = new Schema(
  {
    type: { type: String, enum: ['child', 'self'], required: true },
    childId: { type: String, required: false },
    name: { type: String, required: true },
  },
  { _id: false },
);

// Flat rather than a discriminated subdocument: `kind` says which fields are set.
const scheduleSchema = new Schema(
  {
    kind: { type: String, enum: ['weekly', 'once'], required: true },
    weekday: { type: String, enum: DAYS_OF_WEEK, required: false },
    startDate: { type: Date, required: false },
    endDate: { type: Date, required: false },
    date: { type: Date, required: false },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
  },
  { _id: false },
);

export interface PrivateLessonScheduleDocument {
  kind: 'weekly' | 'once';
  weekday?: DayOfWeek;
  startDate?: Date;
  endDate?: Date;
  date?: Date;
  startTime: string;
  endTime: string;
}

export interface PrivateLessonDocument extends Document {
  userId: string;
  attendee: ClassAttendee;
  instructorStaffId: string;
  title: string;
  schedule: PrivateLessonScheduleDocument;
  rateCents: number;
  notes?: string;
  status: PrivateLessonStatus;
  endedOn?: Date;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

const privateLessonSchema = new Schema<PrivateLessonDocument>(
  {
    userId: { type: String, required: true, index: true },
    attendee: { type: attendeeSchema, required: true },
    instructorStaffId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    schedule: { type: scheduleSchema, required: true },
    rateCents: { type: Number, required: true, min: 0 },
    notes: { type: String, required: false },
    status: { type: String, enum: PRIVATE_LESSON_STATUSES, required: true, default: 'active' },
    endedOn: { type: Date, required: false },
    createdByUserId: { type: String, required: true },
  },
  { timestamps: true },
);

export const PrivateLessonModel =
  mongoose.models['PrivateLesson'] || mongoose.model<PrivateLessonDocument>('PrivateLesson', privateLessonSchema);

export interface PrivateLessonExceptionDocument extends Document {
  lessonId: string;
  date: Date;
  kind: PrivateLessonExceptionKind;
  newDate?: Date;
  newStartTime?: string;
  newEndTime?: string;
  createdByUserId: string;
  createdAt: Date;
}

const privateLessonExceptionSchema = new Schema<PrivateLessonExceptionDocument>(
  {
    lessonId: { type: String, required: true },
    date: { type: Date, required: true },
    kind: { type: String, enum: PRIVATE_LESSON_EXCEPTION_KINDS, required: true },
    newDate: { type: Date, required: false },
    newStartTime: { type: String, required: false },
    newEndTime: { type: String, required: false },
    createdByUserId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

privateLessonExceptionSchema.index({ lessonId: 1, date: 1 }, { unique: true });

export const PrivateLessonExceptionModel =
  mongoose.models['PrivateLessonException'] ||
  mongoose.model<PrivateLessonExceptionDocument>('PrivateLessonException', privateLessonExceptionSchema);
