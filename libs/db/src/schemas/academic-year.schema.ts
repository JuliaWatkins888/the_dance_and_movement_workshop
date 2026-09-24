import mongoose, { Schema, Document } from 'mongoose';

export interface AcademicYearDocument extends Document {
  title: string;
  description?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const academicYearSchema = new Schema<AcademicYearDocument>(
  {
    title: { type: String, required: true, index: true },
    description: { type: String, required: false },
    isPublished: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true },
);

export const AcademicYearModel =
  mongoose.models['AcademicYear'] || mongoose.model<AcademicYearDocument>('AcademicYear', academicYearSchema);
