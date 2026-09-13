import mongoose, { Schema, Document } from 'mongoose';
import { SETTING_TYPES, SettingType } from '../contracts/settings.contract';

export interface SettingsDocument extends Document {
  key: string;
  type: SettingType;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<SettingsDocument>(
  {
    key: { type: String, required: true, unique: true },
    type: { type: String, required: true, enum: SETTING_TYPES },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export const SettingsModel =
  mongoose.models['Settings'] || mongoose.model<SettingsDocument>('Settings', settingsSchema);
