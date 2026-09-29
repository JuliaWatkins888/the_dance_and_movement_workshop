import { isValidObjectId } from 'mongoose';
import type { Model } from 'mongoose';
import {
  CreateShippingMethodInput,
  ShippingMethodEntity,
  ShippingMethodRepository,
  UpdateShippingMethodInput,
} from '../../contracts/shipping-method.contract';
import { toUpdateOperations } from '../../utils/toUpdateOperations';
import { ShippingMethodDocument } from '../../schemas/shipping-method.schema';

const mapToShippingMethodEntity = (doc: ShippingMethodDocument): ShippingMethodEntity => ({
  id: doc._id.toString(),
  name: doc.name,
  description: doc.description,
  amountCents: doc.amountCents,
  freeOverCents: doc.freeOverCents,
  requiresAddress: doc.requiresAddress,
  isActive: doc.isActive,
  sortOrder: doc.sortOrder,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoShippingMethodRepository = (model: Model<ShippingMethodDocument>): ShippingMethodRepository => ({
  findAll: async (): Promise<ShippingMethodEntity[]> => {
    const docs = await model.find().sort({ sortOrder: 1, createdAt: 1 }).exec();
    return docs.map(mapToShippingMethodEntity);
  },
  findActive: async (): Promise<ShippingMethodEntity[]> => {
    const docs = await model.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).exec();
    return docs.map(mapToShippingMethodEntity);
  },
  findById: async (id: string): Promise<ShippingMethodEntity | null> => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapToShippingMethodEntity(doc) : null;
  },
  create: async (input: CreateShippingMethodInput): Promise<ShippingMethodEntity> => {
    const doc = await model.create(input);
    return mapToShippingMethodEntity(doc);
  },
  update: async (id: string, input: UpdateShippingMethodInput): Promise<ShippingMethodEntity | null> => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findByIdAndUpdate(id, toUpdateOperations(input), { new: true, runValidators: true }).exec();
    return doc ? mapToShippingMethodEntity(doc) : null;
  },
  delete: async (id: string): Promise<boolean> => {
    if (!isValidObjectId(id)) return false;
    const result = await model.findByIdAndDelete(id).exec();
    return result !== null;
  },
});
