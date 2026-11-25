import { isValidObjectId } from 'mongoose';
import type { Model } from 'mongoose';
import type { ClassAttendee } from '../../contracts/class-registration.contract';
import type {
  PrivateLessonEntity,
  PrivateLessonExceptionEntity,
  PrivateLessonExceptionRepository,
  PrivateLessonRepository,
  PrivateLessonSchedule,
} from '../../contracts/private-lesson.contract';
import type {
  PrivateLessonDocument,
  PrivateLessonExceptionDocument,
  PrivateLessonScheduleDocument,
} from '../../schemas/private-lesson.schema';

const mapAttendee = (attendee: ClassAttendee & { childId?: string }): ClassAttendee =>
  attendee.type === 'child' && attendee.childId
    ? { type: 'child', childId: attendee.childId, name: attendee.name }
    : { type: 'self', name: attendee.name };

const mapSchedule = (schedule: PrivateLessonScheduleDocument): PrivateLessonSchedule =>
  schedule.kind === 'weekly'
    ? {
        kind: 'weekly',
        weekday: schedule.weekday ?? 'Monday',
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        startDate: schedule.startDate ?? new Date(0),
        ...(schedule.endDate ? { endDate: schedule.endDate } : {}),
      }
    : { kind: 'once', date: schedule.date ?? new Date(0), startTime: schedule.startTime, endTime: schedule.endTime };

const mapLesson = (doc: PrivateLessonDocument): PrivateLessonEntity => ({
  id: doc._id.toString(),
  userId: doc.userId,
  attendee: mapAttendee(doc.attendee),
  instructorStaffId: doc.instructorStaffId,
  title: doc.title,
  schedule: mapSchedule(doc.schedule),
  rateCents: doc.rateCents,
  ...(doc.notes ? { notes: doc.notes } : {}),
  status: doc.status,
  ...(doc.endedOn ? { endedOn: doc.endedOn } : {}),
  createdByUserId: doc.createdByUserId,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const mapException = (doc: PrivateLessonExceptionDocument): PrivateLessonExceptionEntity => ({
  id: doc._id.toString(),
  lessonId: doc.lessonId,
  date: doc.date,
  kind: doc.kind,
  ...(doc.newDate ? { newDate: doc.newDate } : {}),
  ...(doc.newStartTime ? { newStartTime: doc.newStartTime } : {}),
  ...(doc.newEndTime ? { newEndTime: doc.newEndTime } : {}),
  createdByUserId: doc.createdByUserId,
  createdAt: doc.createdAt,
});

export const createMongoPrivateLessonRepository = (model: Model<PrivateLessonDocument>): PrivateLessonRepository => ({
  findAll: async () => (await model.find().sort({ createdAt: -1 }).exec()).map(mapLesson),
  findById: async (id) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapLesson(doc) : null;
  },
  findByUserId: async (userId) => (await model.find({ userId }).sort({ createdAt: -1 }).exec()).map(mapLesson),
  findBillable: async (userId) => (await model.find(userId ? { userId } : {}).exec()).map(mapLesson),
  create: async (input) => mapLesson(await model.create({ ...input, status: 'active' })),
  update: async (id, input) => {
    if (!isValidObjectId(id)) return null;
    const { notes, ...rest } = input;
    const update =
      notes === null ? { $set: rest, $unset: { notes: 1 } } : { $set: { ...rest, ...(notes !== undefined ? { notes } : {}) } };
    const doc = await model.findByIdAndUpdate(id, update, { new: true, runValidators: true }).exec();
    return doc ? mapLesson(doc) : null;
  },
  end: async (id, endedOn) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findByIdAndUpdate(id, { $set: { status: 'ended', endedOn } }, { new: true }).exec();
    return doc ? mapLesson(doc) : null;
  },
  delete: async (id) => {
    if (!isValidObjectId(id)) return false;
    return (await model.deleteOne({ _id: id }).exec()).deletedCount === 1;
  },
});

export const createMongoPrivateLessonExceptionRepository = (
  model: Model<PrivateLessonExceptionDocument>,
): PrivateLessonExceptionRepository => ({
  findByLessonIds: async (lessonIds) =>
    lessonIds.length === 0 ? [] : (await model.find({ lessonId: { $in: lessonIds } }).sort({ date: 1 }).exec()).map(mapException),
  upsert: async (input) => {
    const { lessonId, date, ...rest } = input;
    const unset = rest.kind === 'cancelled' ? { $unset: { newDate: 1, newStartTime: 1, newEndTime: 1 } } : {};
    const doc = await model
      .findOneAndUpdate({ lessonId, date }, { $set: { lessonId, date, ...rest }, ...unset }, { new: true, upsert: true, runValidators: true })
      .exec();
    return mapException(doc);
  },
  deleteOne: async (lessonId, date) => (await model.deleteOne({ lessonId, date }).exec()).deletedCount === 1,
  deleteByLessonId: async (lessonId) => {
    await model.deleteMany({ lessonId }).exec();
  },
});
