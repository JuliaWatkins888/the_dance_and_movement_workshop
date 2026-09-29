import { isValidObjectId } from 'mongoose';
import type { Model } from 'mongoose';
import type {
  CreateProgramInput,
  ProgramEntity,
  ProgramRepository,
  UpdateProgramInput,
} from '../../contracts/program.contract';
import { toUpdateOperations } from '../../utils/toUpdateOperations';
import type { ProgramDocument } from '../../schemas/program.schema';

const mapToProgramEntity = (doc: ProgramDocument): ProgramEntity => ({
  id: doc._id.toString(),
  name: doc.name,
  slug: doc.slug ?? doc._id.toString(),
  description: doc.description ?? undefined,
  minAgeYears: doc.minAgeYears ?? undefined,
  maxAgeYears: doc.maxAgeYears ?? undefined,
  imageUrl: doc.imageUrl ?? undefined,
  imageSourceType: doc.imageSourceType ?? undefined,
  imageStorageKey: doc.imageStorageKey ?? undefined,
  banner: doc.banner
    ? { cellSize: doc.banner.cellSize, variance: doc.banner.variance, xColors: [...doc.banner.xColors], yColors: [...doc.banner.yColors] }
    : undefined,
  order: doc.order,
  isPublished: doc.isPublished,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoProgramRepository = (model: Model<ProgramDocument>): ProgramRepository => ({
  findAll: async () => {
    const docs = await model.find().sort({ order: 1, name: 1 }).exec();
    return docs.map(mapToProgramEntity);
  },
  findById: async (id: string) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapToProgramEntity(doc) : null;
  },
  create: async (input: CreateProgramInput) => mapToProgramEntity(await model.create(input)),
  update: async (id: string, input: UpdateProgramInput) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findByIdAndUpdate(id, toUpdateOperations(input), { new: true, runValidators: true }).exec();
    return doc ? mapToProgramEntity(doc) : null;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) return false;
    return (await model.findByIdAndDelete(id).exec()) !== null;
  },
});
