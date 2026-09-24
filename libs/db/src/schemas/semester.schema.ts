import mongoose, { Schema, Document } from 'mongoose';
import { SEMESTER_TERMS } from '../contracts/semester.contract';
import type { SemesterTerm } from '../contracts/semester.contract';

export interface SemesterDocument extends Document {
  academicYearId: string;
  term: SemesterTerm;
  name: string;
  startDate: Date;
  endDate: Date;
  registrationOpensAt?: Date;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const semesterSchema = new Schema<SemesterDocument>(
  {
    academicYearId: { type: String, required: true, index: true },
    term: { type: String, enum: SEMESTER_TERMS, required: true },
    name: { type: String, required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    registrationOpensAt: { type: Date, required: false },
    isPublished: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true },
);

// Partial so semesters written before academic years existed (no academicYearId yet, until
// libs/db/scripts/migrate-to-academic-years.mjs runs) don't all collide on a shared null key.
semesterSchema.index(
  { academicYearId: 1, term: 1 },
  { unique: true, partialFilterExpression: { academicYearId: { $type: 'string' } } },
);

export const SemesterModel = mongoose.models['Semester'] || mongoose.model<SemesterDocument>('Semester', semesterSchema);
