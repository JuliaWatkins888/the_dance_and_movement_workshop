import { isValidObjectId } from 'mongoose';
import type { Model } from 'mongoose';
import type {
  CalendarEntryEntity,
  CalendarEntryRepository,
  CreateCalendarEntryInput,
  HolidayOpeningEntity,
  HolidayOpeningRepository,
  UpdateCalendarEntryInput,
} from '../../contracts/calendar.contract';
import { toUpdateOperations } from '../../utils/toUpdateOperations';
import type { CalendarEntryDocument } from '../../schemas/calendar-entry.schema';
import type { HolidayOpeningDocument } from '../../schemas/holiday-opening.schema';

const mapToCalendarEntryEntity = (doc: CalendarEntryDocument): CalendarEntryEntity => ({
  id: doc._id.toString(),
  title: doc.title,
  description: doc.description ?? undefined,
  startDate: doc.startDate,
  endDate: doc.endDate,
  startTime: doc.startTime ?? undefined,
  endTime: doc.endTime ?? undefined,
  isStudioClosed: doc.isStudioClosed,
  isAtStudio: doc.isAtStudio,
  venueName: doc.venueName ?? undefined,
  venueAddress: doc.venueAddress ?? undefined,
  linkUrl: doc.linkUrl ?? undefined,
  isPublished: doc.isPublished,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const SORT_BY_START = { startDate: 1, startTime: 1 } as const;

export const createMongoCalendarEntryRepository = (model: Model<CalendarEntryDocument>): CalendarEntryRepository => ({
  findAll: async () => {
    const docs = await model.find().sort(SORT_BY_START).exec();
    return docs.map(mapToCalendarEntryEntity);
  },
  findOverlapping: async (from: Date, to: Date) => {
    const docs = await model
      .find({ startDate: { $lte: to }, endDate: { $gte: from } })
      .sort(SORT_BY_START)
      .exec();
    return docs.map(mapToCalendarEntryEntity);
  },
  findById: async (id: string) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapToCalendarEntryEntity(doc) : null;
  },
  create: async (input: CreateCalendarEntryInput) => mapToCalendarEntryEntity(await model.create(input)),
  update: async (id: string, input: UpdateCalendarEntryInput) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findByIdAndUpdate(id, toUpdateOperations(input), { new: true, runValidators: true }).exec();
    return doc ? mapToCalendarEntryEntity(doc) : null;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) return false;
    return (await model.findByIdAndDelete(id).exec()) !== null;
  },
});

const mapToHolidayOpeningEntity = (doc: HolidayOpeningDocument): HolidayOpeningEntity => ({
  id: doc._id.toString(),
  date: doc.date,
  holidayKey: doc.holidayKey,
  createdAt: doc.createdAt,
});

export const createMongoHolidayOpeningRepository = (model: Model<HolidayOpeningDocument>): HolidayOpeningRepository => ({
  findInRange: async (from: Date, to: Date) => {
    const docs = await model.find({ date: { $gte: from, $lte: to } }).sort({ date: 1 }).exec();
    return docs.map(mapToHolidayOpeningEntity);
  },
  open: async (date: Date, holidayKey: string) => {
    const doc = await model
      .findOneAndUpdate({ date }, { $setOnInsert: { date, holidayKey } }, { upsert: true, new: true })
      .exec();
    return mapToHolidayOpeningEntity(doc);
  },
  close: async (date: Date) => {
    await model.deleteOne({ date }).exec();
  },
});
