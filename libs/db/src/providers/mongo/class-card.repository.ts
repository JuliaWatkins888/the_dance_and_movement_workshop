import { isValidObjectId } from 'mongoose';
import type { Model } from 'mongoose';
import type { ClassAttendee } from '../../contracts/class-registration.contract';
import type {
  ClassCardEntity,
  ClassCardRedemptionEntity,
  ClassCardRedemptionRepository,
  ClassCardRepository,
  ClassCardTypeEntity,
  ClassCardTypeRepository,
} from '../../contracts/class-card.contract';
import type { ClassCardDocument, ClassCardRedemptionDocument, ClassCardTypeDocument } from '../../schemas/class-card.schema';

const mapAttendee = (attendee: ClassAttendee & { childId?: string }): ClassAttendee =>
  attendee.type === 'child' && attendee.childId
    ? { type: 'child', childId: attendee.childId, name: attendee.name }
    : { type: 'self', name: attendee.name };

const attendeeKeyOf = (attendee: ClassAttendee): string => (attendee.type === 'self' ? 'self' : `child:${attendee.childId}`);

const mapCardType = (doc: ClassCardTypeDocument): ClassCardTypeEntity => ({
  id: doc._id.toString(),
  name: doc.name,
  classCount: doc.classCount,
  priceCents: doc.priceCents,
  isActive: doc.isActive,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const mapCard = (doc: ClassCardDocument): ClassCardEntity => ({
  id: doc._id.toString(),
  userId: doc.userId,
  attendee: mapAttendee(doc.attendee),
  cardTypeId: doc.cardTypeId,
  name: doc.name,
  classesTotal: doc.classesTotal,
  classesUsed: doc.classesUsed,
  orderId: doc.orderId,
  orderLineId: doc.orderLineId,
  status: doc.status,
  ...(doc.cancelledAt ? { cancelledAt: doc.cancelledAt } : {}),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const mapRedemption = (doc: ClassCardRedemptionDocument): ClassCardRedemptionEntity => ({
  id: doc._id.toString(),
  cardId: doc.cardId,
  userId: doc.userId,
  attendee: mapAttendee(doc.attendee),
  sectionId: doc.sectionId,
  courseId: doc.courseId,
  classDate: doc.classDate,
  redeemedByUserId: doc.redeemedByUserId,
  status: doc.status,
  ...(doc.voidedAt ? { voidedAt: doc.voidedAt } : {}),
  ...(doc.voidedByUserId ? { voidedByUserId: doc.voidedByUserId } : {}),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoClassCardTypeRepository = (model: Model<ClassCardTypeDocument>): ClassCardTypeRepository => ({
  findAll: async () => (await model.find().sort({ classCount: 1, name: 1 }).exec()).map(mapCardType),
  findById: async (id) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapCardType(doc) : null;
  },
  create: async (input) => mapCardType(await model.create(input)),
  update: async (id, input) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    return doc ? mapCardType(doc) : null;
  },
  delete: async (id) => {
    if (!isValidObjectId(id)) return false;
    return (await model.deleteOne({ _id: id }).exec()).deletedCount === 1;
  },
});

export const createMongoClassCardRepository = (model: Model<ClassCardDocument>): ClassCardRepository => {
  const updateById = async (filter: Record<string, unknown>, update: Record<string, unknown>) => {
    const doc = await model.findOneAndUpdate(filter, update, { new: true }).exec();
    return doc ? mapCard(doc) : null;
  };

  return {
    findById: async (id) => {
      if (!isValidObjectId(id)) return null;
      const doc = await model.findById(id).exec();
      return doc ? mapCard(doc) : null;
    },
    findByUserId: async (userId) => (await model.find({ userId }).sort({ createdAt: -1 }).exec()).map(mapCard),
    findByOrderLineId: async (orderLineId) => {
      const doc = await model.findOne({ orderLineId }).exec();
      return doc ? mapCard(doc) : null;
    },
    hasCardsOfType: async (cardTypeId) => (await model.exists({ cardTypeId }).exec()) !== null,
    findUsable: async () =>
      (await model.find({ status: 'active', $expr: { $lt: ['$classesUsed', '$classesTotal'] } }).sort({ createdAt: 1 }).exec()).map(mapCard),
    create: async (input) => mapCard(await model.create({ ...input, classesUsed: 0, status: 'active' })),
    useClass: async (id) =>
      isValidObjectId(id)
        ? updateById({ _id: id, status: 'active', $expr: { $lt: ['$classesUsed', '$classesTotal'] } }, { $inc: { classesUsed: 1 } })
        : null,
    restoreClass: async (id) => (isValidObjectId(id) ? updateById({ _id: id, classesUsed: { $gt: 0 } }, { $inc: { classesUsed: -1 } }) : null),
    cancel: async (id, at) => (isValidObjectId(id) ? updateById({ _id: id, status: 'active' }, { $set: { status: 'cancelled', cancelledAt: at } }) : null),
  };
};

export const createMongoClassCardRedemptionRepository = (model: Model<ClassCardRedemptionDocument>): ClassCardRedemptionRepository => ({
  findById: async (id) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapRedemption(doc) : null;
  },
  findByCardIds: async (cardIds) =>
    cardIds.length === 0 ? [] : (await model.find({ cardId: { $in: cardIds } }).sort({ classDate: -1, createdAt: -1 }).exec()).map(mapRedemption),
  findActiveBySectionDate: async (sectionId, classDate) =>
    (await model.find({ sectionId, classDate, status: 'active' }).sort({ createdAt: 1 }).exec()).map(mapRedemption),
  create: async (input) => mapRedemption(await model.create({ ...input, attendeeKey: attendeeKeyOf(input.attendee), status: 'active' })),
  void: async (id, voidedByUserId, at) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model
      .findOneAndUpdate({ _id: id, status: 'active' }, { $set: { status: 'voided', voidedAt: at, voidedByUserId } }, { new: true })
      .exec();
    return doc ? mapRedemption(doc) : null;
  },
});
