import mongoose, { Schema, Document } from 'mongoose';

export interface SemesterDocument extends Document {
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
    name: { type: String, required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    registrationOpensAt: { type: Date, required: false },
    isPublished: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true },
);

export const SemesterModel = mongoose.models['Semester'] || mongoose.model<SemesterDocument>('Semester', semesterSchema);
