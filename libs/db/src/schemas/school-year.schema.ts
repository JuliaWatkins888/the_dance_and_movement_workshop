import mongoose, { Schema, Document, Types } from 'mongoose';

export interface SemesterSubdocument {
  _id: Types.ObjectId;
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface SchoolYearDocument extends Document {
  name: string;
  registrationOpensAt?: Date;
  semesters: SemesterSubdocument[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const semesterSchema = new Schema<SemesterSubdocument>({
  name: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
});

const schoolYearSchema = new Schema<SchoolYearDocument>(
  {
    name: { type: String, required: true },
    registrationOpensAt: { type: Date, required: false },
    semesters: { type: [semesterSchema], required: true, default: [] },
    isPublished: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export const SchoolYearModel =
  mongoose.models['SchoolYear'] || mongoose.model<SchoolYearDocument>('SchoolYear', schoolYearSchema);
