import type { Model } from 'mongoose';
import { SettingEntity, SettingsRepository, UpsertSettingInput } from '../../contracts/settings.contract';
import { SettingsDocument } from '../../schemas/settings.schema';

const mapToSettingEntity = (doc: SettingsDocument): SettingEntity =>
  ({
    id: doc._id.toString(),
    key: doc.key,
    type: doc.type,
    value: doc.value,
    updatedAt: doc.updatedAt,
  }) as SettingEntity;

export const createMongoSettingsRepository = (model: Model<SettingsDocument>): SettingsRepository => ({
  findAll: async (): Promise<SettingEntity[]> => {
    const docs = await model.find().exec();
    return docs.map(mapToSettingEntity);
  },
  findByKey: async (key: string): Promise<SettingEntity | null> => {
    const doc = await model.findOne({ key }).exec();
    return doc ? mapToSettingEntity(doc) : null;
  },
  upsert: async (input: UpsertSettingInput): Promise<SettingEntity> => {
    const doc = await model
      .findOneAndUpdate(
        { key: input.key },
        { $set: { type: input.type, value: input.value } },
        { new: true, upsert: true, runValidators: true },
      )
      .exec();
    // upsert + new together always return the (now-existing) document, never null.
    return mapToSettingEntity(doc as SettingsDocument);
  },
});
