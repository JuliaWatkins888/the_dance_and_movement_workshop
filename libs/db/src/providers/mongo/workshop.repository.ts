import { isValidObjectId } from 'mongoose';
import type { Model } from 'mongoose';
import type {
  CreateWorkshopInput,
  UpdateWorkshopInput,
  WorkshopDayEntity,
  WorkshopDayInput,
  WorkshopEntity,
  WorkshopInstructor,
  WorkshopRepository,
} from '../../contracts/workshop.contract';
import { toUpdateOperations } from '../../utils/toUpdateOperations';
import type { WorkshopDayDocument, WorkshopDocument, WorkshopInstructorDocument } from '../../schemas/workshop.schema';

const mapDay = (doc: WorkshopDayDocument): WorkshopDayEntity => ({
  id: doc._id.toString(),
  date: doc.date,
  startTime: doc.startTime,
  endTime: doc.endTime,
  startsAt: doc.startsAt,
  endsAt: doc.endsAt,
  agenda: doc.agenda ?? undefined,
  capacity: doc.capacity,
  enrolled: doc.enrolled,
});

const mapInstructor = (doc: WorkshopInstructorDocument): WorkshopInstructor =>
  doc.type === 'staff'
    ? { type: 'staff', staffId: doc.staffId ?? '' }
    : {
        type: 'guest',
        name: doc.name ?? '',
        bio: doc.bio ?? undefined,
        photoUrl: doc.photoUrl ?? undefined,
        photoSourceType: doc.photoSourceType ?? undefined,
        photoAssetId: doc.photoAssetId ?? undefined,
      };

const mapToWorkshopEntity = (doc: WorkshopDocument): WorkshopEntity => ({
  id: doc._id.toString(),
  title: doc.title,
  slug: doc.slug,
  description: doc.description ?? undefined,
  dressCode: doc.dressCode ?? undefined,
  styles: doc.styles ?? [],
  level: doc.level ?? undefined,
  minAgeYears: doc.minAgeYears ?? undefined,
  maxAgeYears: doc.maxAgeYears ?? undefined,
  instructors: (doc.instructors ?? []).map(mapInstructor),
  days: (doc.days ?? []).map(mapDay).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
  pricePerDayCents: doc.pricePerDayCents,
  fullWorkshopDiscountPercent: doc.fullWorkshopDiscountPercent ?? 0,
  imageUrl: doc.imageUrl ?? undefined,
  imageSourceType: doc.imageSourceType ?? undefined,
  imageAssetId: doc.imageAssetId ?? undefined,
  banner: doc.banner
    ? {
        cellSize: doc.banner.cellSize,
        variance: doc.banner.variance,
        xColors: [...doc.banner.xColors],
        yColors: [...doc.banner.yColors],
      }
    : undefined,
  isPublished: doc.isPublished,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

// An existing day keeps its _id so seat counts and registrations stay attached to it.
const toDayDocument = ({ id, ...day }: WorkshopDayInput) => (id ? { _id: id, ...day } : day);

export const createMongoWorkshopRepository = (model: Model<WorkshopDocument>): WorkshopRepository => ({
  findAll: async () => {
    const docs = await model.find().exec();
    return docs.map(mapToWorkshopEntity);
  },
  findById: async (id: string) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapToWorkshopEntity(doc) : null;
  },
  findBySlug: async (slug: string) => {
    const doc = await model.findOne({ slug }).exec();
    return doc ? mapToWorkshopEntity(doc) : null;
  },
  create: async ({ days, ...input }: CreateWorkshopInput) =>
    mapToWorkshopEntity(await model.create({ ...input, days: days.map(toDayDocument) })),
  update: async (id: string, { days, ...input }: UpdateWorkshopInput) => {
    if (!isValidObjectId(id)) return null;
    const operations = toUpdateOperations({
      ...input,
      ...(days ? { days: days.map(toDayDocument) } : {}),
    });
    const doc = await model.findByIdAndUpdate(id, operations, { new: true, runValidators: true }).exec();
    return doc ? mapToWorkshopEntity(doc) : null;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) return false;
    return (await model.findByIdAndDelete(id).exec()) !== null;
  },
  // Compares against the capacity just read (Mongo can't compare two fields of one array element
  // in a query) - concurrent reservations still can't overshoot it, since each claim re-checks
  // `enrolled` atomically.
  reserveDaySeat: async (workshopId: string, dayId: string) => {
    if (!isValidObjectId(workshopId) || !isValidObjectId(dayId)) return false;
    const doc = await model.findById(workshopId).exec();
    const day = doc?.days.find((candidate: WorkshopDayDocument) => candidate._id.toString() === dayId);
    if (!day || day.enrolled >= day.capacity) return false;
    const result = await model
      .updateOne(
        {
          _id: workshopId,
          days: { $elemMatch: { _id: dayId, enrolled: { $lt: day.capacity } } },
        },
        { $inc: { 'days.$.enrolled': 1 } },
      )
      .exec();
    return result.modifiedCount === 1;
  },
  releaseDaySeat: async (workshopId: string, dayId: string) => {
    if (!isValidObjectId(workshopId) || !isValidObjectId(dayId)) return;
    await model
      .updateOne(
        {
          _id: workshopId,
          days: { $elemMatch: { _id: dayId, enrolled: { $gte: 1 } } },
        },
        { $inc: { 'days.$.enrolled': -1 } },
      )
      .exec();
  },
});
