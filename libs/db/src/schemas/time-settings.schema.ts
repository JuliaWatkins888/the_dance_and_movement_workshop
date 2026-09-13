import mongoose, { Schema, Document } from 'mongoose';

export interface TimeSettingsDocument extends Document {
  // Never read/written outside this file - a hidden, DB-level guarantee that a repository bug
  // can never spawn a second settings document, the same discipline settings.schema.ts's own
  // `key: { unique: true }` applies to its per-key rows.
  singletonKey: string;
  timezone: string;
  autoClockoutThresholdMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const timeSettingsSchema = new Schema<TimeSettingsDocument>(
  {
    singletonKey: { type: String, required: true, unique: true, default: 'default' },
    // America/New_York (Eastern Time, DST-aware) rather than a fixed 'EST' offset - the latter
    // never observes daylight saving in the IANA database, which would silently drift an hour off
    // from what "Eastern Time" actually means for half the year.
    timezone: { type: String, required: true, default: 'America/New_York' },
    autoClockoutThresholdMinutes: { type: Number, required: true, default: 720 },
  },
  { timestamps: true },
);

export const TimeSettingsModel =
  mongoose.models['TimeSettings'] || mongoose.model<TimeSettingsDocument>('TimeSettings', timeSettingsSchema);
