import type { Model } from 'mongoose';
import { CartEntity, CartLine, CartRepository, SaveCartInput } from '../../contracts/cart.contract';
import { CartDocument } from '../../schemas/cart.schema';

const mapToCartEntity = (doc: CartDocument): CartEntity => {
  const plain = doc.toObject();
  return {
    id: doc._id.toString(),
    userId: plain.userId,
    lines: ((plain.lines ?? []) as CartLine[]).map((line) => ({
      id: line.id,
      sourceType: line.sourceType,
      sourceId: line.sourceId,
      variantId: line.variantId,
      options: line.options ?? {},
      quantity: line.quantity,
      addedAt: line.addedAt,
    })),
    discountCode: plain.discountCode ?? null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

export const createMongoCartRepository = (model: Model<CartDocument>): CartRepository => ({
  findByUserId: async (userId: string): Promise<CartEntity | null> => {
    const doc = await model.findOne({ userId }).exec();
    return doc ? mapToCartEntity(doc) : null;
  },
  save: async (userId: string, input: SaveCartInput): Promise<CartEntity> => {
    const doc = await model
      .findOneAndUpdate({ userId }, { $set: input }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true })
      .exec();
    return mapToCartEntity(doc);
  },
  removeLines: async (userId: string, lineIds: string[]): Promise<void> => {
    if (lineIds.length === 0) return;
    await model.updateOne({ userId }, { $pull: { lines: { id: { $in: lineIds } } } }).exec();
  },
});
