import mongoose, { Schema, Document } from 'mongoose';
import { CHILD_GENDERS, ChildGender } from '../contracts/child.contract';

export interface ChildDocument extends Document {
  parentUserId: string;
  firstName: string;
  lastName?: string;
  birthDate: Date;
  gender: ChildGender;
  createdAt: Date;
  updatedAt: Date;
}

const childSchema = new Schema<ChildDocument>(
  {
    // Indexed (for findByParentUserId lookups) but NOT unique - unlike staff's one-record-per-user
    // constraint, a parent account can have unlimited child accounts.
    parentUserId: { type: String, required: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: false },
    birthDate: { type: Date, required: true },
    gender: { type: String, enum: CHILD_GENDERS, required: true },
  },
  { timestamps: true },
);

export const ChildModel = mongoose.models['Child'] || mongoose.model<ChildDocument>('Child', childSchema);
