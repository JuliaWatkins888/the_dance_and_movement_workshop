import type { Model } from 'mongoose';
import type { ClassAttendee } from '../../contracts/class-registration.contract';
import type {
  CreateWorkshopRegistrationInput,
  WorkshopRegistrationEntity,
  WorkshopRegistrationRepository,
} from '../../contracts/workshop-registration.contract';
import type { WorkshopRegistrationDocument } from '../../schemas/workshop-registration.schema';

const mapAttendee = (attendee: ClassAttendee & { childId?: string }): ClassAttendee =>
  attendee.type === 'child' && attendee.childId
    ? { type: 'child', childId: attendee.childId, name: attendee.name }
    : { type: 'self', name: attendee.name };

const mapToWorkshopRegistrationEntity = (doc: WorkshopRegistrationDocument): WorkshopRegistrationEntity => ({
  id: doc._id.toString(),
  userId: doc.userId,
  attendee: mapAttendee(doc.attendee),
  workshopId: doc.workshopId,
  dayIds: doc.dayIds ?? [],
  isFullWorkshop: doc.isFullWorkshop,
  orderId: doc.orderId,
  orderLineId: doc.orderLineId,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoWorkshopRegistrationRepository = (model: Model<WorkshopRegistrationDocument>): WorkshopRegistrationRepository => ({
  findByUserId: async (userId: string) => {
    const docs = await model.find({ userId }).sort({ createdAt: -1 }).exec();
    return docs.map(mapToWorkshopRegistrationEntity);
  },
  findByWorkshop: async (workshopId: string) => {
    const docs = await model.find({ workshopId }).sort({ createdAt: 1 }).exec();
    return docs.map(mapToWorkshopRegistrationEntity);
  },
  findByOrderLineId: async (orderLineId: string) => {
    const doc = await model.findOne({ orderLineId }).exec();
    return doc ? mapToWorkshopRegistrationEntity(doc) : null;
  },
  create: async (input: CreateWorkshopRegistrationInput) => mapToWorkshopRegistrationEntity(await model.create(input)),
});
