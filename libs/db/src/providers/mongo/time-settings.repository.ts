import type { Model } from 'mongoose';
import { TimeSettingsEntity, TimeSettingsRepository, UpdateTimeSettingsInput } from '../../contracts/time-settings.contract';
import { TimeSettingsDocument } from '../../schemas/time-settings.schema';

const mapToTimeSettingsEntity = (doc: TimeSettingsDocument): TimeSettingsEntity => ({
  id: doc._id.toString(),
  timezone: doc.timezone,
  autoClockoutThresholdMinutes: doc.autoClockoutThresholdMinutes,
  updatedAt: doc.updatedAt,
});

export const createMongoTimeSettingsRepository = (model: Model<TimeSettingsDocument>): TimeSettingsRepository => ({
  get: async (): Promise<TimeSettingsEntity | null> => {
    const doc = await model.findOne({ singletonKey: 'default' }).exec();
    return doc ? mapToTimeSettingsEntity(doc) : null;
  },
  upsert: async (input: UpdateTimeSettingsInput): Promise<TimeSettingsEntity> => {
    const existing = await model.findOne({ singletonKey: 'default' }).exec();
    if (!existing) {
      const created = await model.create({ singletonKey: 'default', ...input });
      return mapToTimeSettingsEntity(created);
    }
    const updated = await model
      .findByIdAndUpdate(existing._id, { $set: input }, { new: true, runValidators: true })
      .exec();
    return mapToTimeSettingsEntity(updated ?? existing);
  },
});
