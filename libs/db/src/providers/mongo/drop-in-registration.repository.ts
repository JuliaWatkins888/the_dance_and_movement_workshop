import { isValidObjectId } from 'mongoose';
import type { Model } from 'mongoose';
import type { ClassAttendee } from '../../contracts/class-registration.contract';
import type {
  CreateDropInRegistrationInput,
  DropInRegistrationEntity,
  DropInRegistrationRepository,
} from '../../contracts/drop-in-registration.contract';
import type { DropInRegistrationDocument, DropInSeatDocument } from '../../schemas/drop-in-registration.schema';
import { toDateKey } from '../../utils/class-sessions';

const DUPLICATE_KEY = 11000;

const mapAttendee = (attendee: ClassAttendee & { childId?: string }): ClassAttendee =>
  attendee.type === 'child' && attendee.childId
    ? { type: 'child', childId: attendee.childId, name: attendee.name }
    : { type: 'self', name: attendee.name };

const attendeeKeyOf = (attendee: ClassAttendee): string => (attendee.type === 'self' ? 'self' : `child:${attendee.childId}`);

const mapToEntity = (doc: DropInRegistrationDocument): DropInRegistrationEntity => ({
  id: doc._id.toString(),
  userId: doc.userId,
  attendee: mapAttendee(doc.attendee),
  sectionId: doc.sectionId,
  courseId: doc.courseId,
  schoolYearId: doc.schoolYearId,
  classDate: doc.classDate,
  orderId: doc.orderId,
  orderLineId: doc.orderLineId,
  status: doc.status,
  ...(doc.cancelledAt ? { cancelledAt: doc.cancelledAt } : {}),
  ...(doc.cancelledByUserId ? { cancelledByUserId: doc.cancelledByUserId } : {}),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const isDuplicateKey = (error: unknown): boolean => (error as { code?: number } | null)?.code === DUPLICATE_KEY;

export const createMongoDropInRegistrationRepository = (
  model: Model<DropInRegistrationDocument>,
  seatModel: Model<DropInSeatDocument>,
): DropInRegistrationRepository => ({
  findById: async (id) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapToEntity(doc) : null;
  },
  findByUserId: async (userId) => (await model.find({ userId }).sort({ classDate: -1 }).exec()).map(mapToEntity),
  findByOrderLineId: async (orderLineId) => {
    const doc = await model.findOne({ orderLineId }).exec();
    return doc ? mapToEntity(doc) : null;
  },
  findBySectionDate: async (sectionId, classDate) =>
    (await model.find({ sectionId, classDate }).sort({ createdAt: 1 }).exec()).map(mapToEntity),
  findActiveForAttendee: async (userId, sectionId, classDate, attendeeKey) => {
    const doc = await model.findOne({ userId, sectionId, classDate, attendeeKey, status: 'active' }).exec();
    return doc ? mapToEntity(doc) : null;
  },
  create: async (input: CreateDropInRegistrationInput) =>
    mapToEntity(await model.create({ ...input, attendeeKey: attendeeKeyOf(input.attendee), status: 'active' })),
  cancel: async (id, cancelledByUserId, at) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model
      .findOneAndUpdate({ _id: id, status: 'active' }, { $set: { status: 'cancelled', cancelledAt: at, cancelledByUserId } }, { new: true })
      .exec();
    return doc ? mapToEntity(doc) : null;
  },

  countForSectionDate: async (sectionId, classDate) => (await seatModel.findOne({ sectionId, classDate }).exec())?.held ?? 0,
  countForSectionDates: async (sectionId, from, to) => {
    const docs = await seatModel.find({ sectionId, classDate: { $gte: from, $lte: to } }).exec();
    return new Map(docs.filter((doc) => doc.held > 0).map((doc) => [toDateKey(doc.classDate), doc.held]));
  },
  reserveSeat: async (sectionId, classDate, limit) => {
    if (limit <= 0) return false;
    try {
      // The counter document is created on first use; the filter only matches while there's room.
      const result = await seatModel
        .updateOne({ sectionId, classDate, held: { $lt: limit } }, { $inc: { held: 1 } }, { upsert: true })
        .exec();
      return result.modifiedCount === 1 || result.upsertedCount === 1;
    } catch (error) {
      // The upsert collided with the existing (full) counter on the unique index.
      if (isDuplicateKey(error)) return false;
      throw error;
    }
  },
  releaseSeat: async (sectionId, classDate) => {
    await seatModel.updateOne({ sectionId, classDate, held: { $gt: 0 } }, { $inc: { held: -1 } }).exec();
  },
});
