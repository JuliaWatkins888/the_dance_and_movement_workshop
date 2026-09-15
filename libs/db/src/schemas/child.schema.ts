import mongoose, { Schema, Document } from 'mongoose';
import { CHILD_GENDERS, ChildGender, ChildRegistrationEntry } from '../contracts/child.contract';

export interface ChildDocument extends Document {
  parentUserId: string;
  firstName: string;
  lastName?: string;
  age: number;
  gender: ChildGender;
  activeRegistrations: ChildRegistrationEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const childRegistrationEntrySchema = new Schema<ChildRegistrationEntry>(
  {
    classId: { type: String, required: true },
    registeredAt: { type: Date, required: true },
  },
  { _id: false },
);

const childSchema = new Schema<ChildDocument>(
  {
    // Indexed (for findByParentUserId lookups) but NOT unique - unlike staff's one-record-per-user
    // constraint, a parent account can have unlimited child accounts.
    parentUserId: { type: String, required: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: false },
    age: { type: Number, required: true },
    gender: { type: String, enum: CHILD_GENDERS, required: true },
    activeRegistrations: { type: [childRegistrationEntrySchema], required: true, default: [] },
  },
  { timestamps: true },
);

export const ChildModel = mongoose.models['Child'] || mongoose.model<ChildDocument>('Child', childSchema);
