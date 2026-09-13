import type { Model } from 'mongoose';
import {
  CreateTimeEntryTypeInput,
  TimeEntryTypeEntity,
  TimeEntryTypeRepository,
  UpdateTimeEntryTypeInput,
} from '../../contracts/time-entry-type.contract';
import { TimeEntryTypeDocument } from '../../schemas/time-entry-type.schema';

const mapToTimeEntryTypeEntity = (doc: TimeEntryTypeDocument): TimeEntryTypeEntity => ({
  id: doc._id.toString(),
  label: doc.label,
  order: doc.order,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoTimeEntryTypeRepository = (model: Model<TimeEntryTypeDocument>): TimeEntryTypeRepository => ({
  findAll: async (): Promise<TimeEntryTypeEntity[]> => {
    const docs = await model.find().sort({ order: 1, createdAt: 1 }).exec();
    return docs.map(mapToTimeEntryTypeEntity);
  },
  findById: async (id: string): Promise<TimeEntryTypeEntity | null> => {
    const doc = await model.findById(id).exec();
    return doc ? mapToTimeEntryTypeEntity(doc) : null;
  },
  countAll: async (): Promise<number> => model.countDocuments().exec(),
  create: async (input: CreateTimeEntryTypeInput): Promise<TimeEntryTypeEntity> => {
    const doc = await model.create({ label: input.label, order: input.order ?? 0 });
    return mapToTimeEntryTypeEntity(doc);
  },
  update: async (id: string, input: UpdateTimeEntryTypeInput): Promise<TimeEntryTypeEntity | null> => {
    const doc = await model.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    return doc ? mapToTimeEntryTypeEntity(doc) : null;
  },
  delete: async (id: string): Promise<boolean> => {
    const result = await model.findByIdAndDelete(id).exec();
    return result !== null;
  },
});
