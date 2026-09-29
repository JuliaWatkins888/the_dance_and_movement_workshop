import { isValidObjectId } from 'mongoose';
import type { Model } from 'mongoose';
import type {
  ClassAttendee,
  ClassRegistrationEntity,
  ClassRegistrationRepository,
  CreateClassRegistrationInput,
  UpdateClassRegistrationInput,
} from '../../contracts/class-registration.contract';
import type { ClassRegistrationDocument } from '../../schemas/class-registration.schema';

const mapAttendee = (attendee: ClassAttendee & { childId?: string }): ClassAttendee =>
  attendee.type === 'child' && attendee.childId
    ? { type: 'child', childId: attendee.childId, name: attendee.name }
    : { type: 'self', name: attendee.name };

const mapToClassRegistrationEntity = (doc: ClassRegistrationDocument): ClassRegistrationEntity => ({
  id: doc._id.toString(),
  userId: doc.userId,
  attendee: mapAttendee(doc.attendee),
  sectionId: doc.sectionId,
  courseId: doc.courseId,
  schoolYearId: doc.schoolYearId,
  plan: doc.plan,
  semesterId: doc.semesterId ?? undefined,
  startsAt: doc.startsAt,
  endsAt: doc.endsAt,
  orderId: doc.orderId,
  orderLineId: doc.orderLineId,
  subscriptionId: doc.subscriptionId ?? undefined,
  subscriptionLineId: doc.subscriptionLineId ?? undefined,
  status: doc.status,
  withdrawnAt: doc.withdrawnAt ?? undefined,
  accessEndsAt: doc.accessEndsAt ?? undefined,
  seatReleased: doc.seatReleased,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoClassRegistrationRepository = (model: Model<ClassRegistrationDocument>): ClassRegistrationRepository => ({
  findById: async (id: string) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapToClassRegistrationEntity(doc) : null;
  },
  findByUserId: async (userId: string) => {
    const docs = await model.find({ userId }).sort({ startsAt: -1, createdAt: -1 }).exec();
    return docs.map(mapToClassRegistrationEntity);
  },
  findBySection: async (sectionId: string) => {
    const docs = await model.find({ sectionId }).exec();
    return docs.map(mapToClassRegistrationEntity);
  },
  findByOrderLineId: async (orderLineId: string) => {
    const doc = await model.findOne({ orderLineId }).exec();
    return doc ? mapToClassRegistrationEntity(doc) : null;
  },
  findSeatsToRelease: async (now: Date) => {
    const docs = await model.find({ status: 'withdrawn', seatReleased: false, accessEndsAt: { $lte: now } }).exec();
    return docs.map(mapToClassRegistrationEntity);
  },
  create: async (input: CreateClassRegistrationInput) => mapToClassRegistrationEntity(await model.create(input)),
  update: async (id: string, input: UpdateClassRegistrationInput) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    return doc ? mapToClassRegistrationEntity(doc) : null;
  },
  markSeatReleased: async (id: string) => {
    if (!isValidObjectId(id)) return false;
    const result = await model.updateOne({ _id: id, seatReleased: false }, { $set: { seatReleased: true } }).exec();
    return result.modifiedCount === 1;
  },
});
