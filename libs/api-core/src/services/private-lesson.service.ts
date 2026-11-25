import { ConflictError, NotFoundError, ValidationError } from '@inithium/api-utils';
import {
  addDaysToKey,
  dateKeyToUtc,
  describeAttendee,
  expandPrivateLesson,
  getLedgerEntryRepository,
  getPrivateLessonExceptionRepository,
  getPrivateLessonRepository,
  getTimeSettings,
  getUserRepository,
  isPrivateLessonScheduledOn,
  isValidDateKey,
  privateLessonFirstDateKey,
  resolveStudioClosedDateKeys,
  toDateKey,
  zonedDateKey,
  zonedWallTimeToUtc,
} from '@inithium/db';
import type {
  ClassAttendee,
  CreatePrivateLessonInput,
  PrivateLessonEntity,
  PrivateLessonExceptionEntity,
  PrivateLessonOccurrence,
  PrivateLessonSchedule,
  UserEntity,
} from '@inithium/db';
import { accruePrivateLessonCharges } from '@inithium/ecommerce';
import type {
  CreatePrivateLessonBody,
  PrivateLessonExceptionBody,
  PrivateLessonScheduleBody,
  UpdatePrivateLessonBody,
} from '../schemas/private-lessons.schema';
import { loadInstructorDirectory } from './class-catalog.service';
import type { InstructorDirectory } from './class-catalog.service';

// How far ahead a lesson's upcoming dates are listed.
const UPCOMING_LOOKAHEAD_DAYS = 56;
const UPCOMING_LIMIT = 6;

const fullName = (person: { firstName: string; lastName?: string }): string => [person.firstName, person.lastName].filter(Boolean).join(' ');

interface StudioClock {
  timezone: string;
  now: Date;
  todayKey: string;
}

const loadClock = async (now: Date = new Date()): Promise<StudioClock> => {
  const { timezone } = await getTimeSettings();
  return { timezone, now, todayKey: zonedDateKey(now, timezone) };
};

const startsAt = (dateKey: string, time: string, clock: StudioClock): Date => zonedWallTimeToUtc(`${dateKey}T${time}`, clock.timezone);

// ---- DTOs --------------------------------------------------------------------------------------

export type PrivateLessonScheduleDto =
  | { kind: 'weekly'; weekday: string; startTime: string; endTime: string; startDate: string; endDate?: string }
  | { kind: 'once'; date: string; startTime: string; endTime: string };

export type PrivateLessonOccurrenceDto = PrivateLessonOccurrence & { hasStarted: boolean };

const toScheduleDto = (schedule: PrivateLessonSchedule): PrivateLessonScheduleDto =>
  schedule.kind === 'weekly'
    ? {
        kind: 'weekly',
        weekday: schedule.weekday,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        startDate: toDateKey(schedule.startDate),
        ...(schedule.endDate ? { endDate: toDateKey(schedule.endDate) } : {}),
      }
    : { kind: 'once', date: toDateKey(schedule.date), startTime: schedule.startTime, endTime: schedule.endTime };

const toOccurrenceDto = (occurrence: PrivateLessonOccurrence, clock: StudioClock): PrivateLessonOccurrenceDto => ({
  ...occurrence,
  hasStarted: startsAt(occurrence.date, occurrence.startTime, clock) <= clock.now,
});

const instructorOf = (staffId: string, directory: InstructorDirectory) => {
  const instructor = directory.get(staffId);
  return instructor ? { id: instructor.id, name: instructor.name } : undefined;
};

// Upcoming occurrences (cancelled ones included, marked) for a batch of lessons.
const loadUpcoming = async (lessons: PrivateLessonEntity[], clock: StudioClock): Promise<Map<string, PrivateLessonOccurrenceDto[]>> => {
  if (lessons.length === 0) return new Map();
  const lastKey = addDaysToKey(clock.todayKey, UPCOMING_LOOKAHEAD_DAYS);
  const [exceptions, closedDates] = await Promise.all([
    getPrivateLessonExceptionRepository().findByLessonIds(lessons.map((lesson) => lesson.id)),
    resolveStudioClosedDateKeys(clock.todayKey, lastKey),
  ]);
  return new Map(
    lessons.map((lesson) => [
      lesson.id,
      expandPrivateLesson(lesson, exceptions.filter((exception) => exception.lessonId === lesson.id), closedDates, clock.todayKey, lastKey)
        .map((occurrence) => toOccurrenceDto(occurrence, clock))
        .filter((occurrence) => !occurrence.hasStarted)
        .slice(0, UPCOMING_LIMIT),
    ]),
  );
};

const toFamilyLessonDto = (lesson: PrivateLessonEntity, directory: InstructorDirectory, upcoming: PrivateLessonOccurrenceDto[]) => ({
  id: lesson.id,
  attendee: lesson.attendee,
  instructor: instructorOf(lesson.instructorStaffId, directory),
  title: lesson.title,
  schedule: toScheduleDto(lesson.schedule),
  rateCents: lesson.rateCents,
  status: lesson.status,
  ...(lesson.endedOn ? { endedOn: toDateKey(lesson.endedOn) } : {}),
  upcoming,
});

const toAdminLessonDto = (
  lesson: PrivateLessonEntity,
  directory: InstructorDirectory,
  upcoming: PrivateLessonOccurrenceDto[],
  account: UserEntity | null,
) => ({
  ...toFamilyLessonDto(lesson, directory, upcoming),
  userId: lesson.userId,
  account: account ? { id: account.id, name: fullName(account), email: account.email } : undefined,
  ...(lesson.notes ? { notes: lesson.notes } : {}),
  createdAt: lesson.createdAt,
});

const loadAccounts = async (userIds: string[]): Promise<Map<string, UserEntity | null>> => {
  const unique = [...new Set(userIds)];
  const users = await Promise.all(unique.map((id) => getUserRepository().findById(id)));
  return new Map(unique.map((id, index) => [id, users[index] ?? null]));
};

const toAdminDtos = async (lessons: PrivateLessonEntity[]) => {
  const clock = await loadClock();
  const [directory, upcoming, accounts] = await Promise.all([
    loadInstructorDirectory(),
    loadUpcoming(lessons, clock),
    loadAccounts(lessons.map((lesson) => lesson.userId)),
  ]);
  return lessons.map((lesson) => toAdminLessonDto(lesson, directory, upcoming.get(lesson.id) ?? [], accounts.get(lesson.userId) ?? null));
};

// ---- Reads -------------------------------------------------------------------------------------

export const listPrivateLessonsAdmin = async () => toAdminDtos(await getPrivateLessonRepository().findAll());

export const getPrivateLessonAdmin = async (id: string) => {
  const lesson = await requireLesson(id);
  const [dto] = await toAdminDtos([lesson]);
  return dto;
};

export const listAccountPrivateLessons = async (userId: string) => {
  if (!(await getUserRepository().findById(userId))) throw NotFoundError('Account not found');
  return toAdminDtos(await getPrivateLessonRepository().findByUserId(userId));
};

// What the family sees on their profile: no staff notes. Posts any lessons already taught first, so
// the ledger is current when they look.
export const listMyPrivateLessons = async (userId: string) => {
  await accruePrivateLessonCharges(userId);
  const lessons = await getPrivateLessonRepository().findByUserId(userId);
  const clock = await loadClock();
  const [directory, upcoming] = await Promise.all([loadInstructorDirectory(), loadUpcoming(lessons, clock)]);
  return lessons
    .map((lesson) => toFamilyLessonDto(lesson, directory, upcoming.get(lesson.id) ?? []))
    .filter((lesson) => lesson.status === 'active' || lesson.upcoming.length > 0);
};

export const listPrivateLessonInstructors = async () =>
  [...(await loadInstructorDirectory()).values()].map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

// The staff schedule: every occurrence in [from, to), optionally for one instructor.
export const buildPrivateLessonSchedule = async (range: { from: string; to: string; instructorStaffId?: string }) => {
  const lastKey = addDaysToKey(range.to, -1);
  const lessons = (await getPrivateLessonRepository().findAll()).filter(
    (lesson) => !range.instructorStaffId || lesson.instructorStaffId === range.instructorStaffId,
  );
  const clock = await loadClock();
  const [directory, exceptions, closedDates, accounts] = await Promise.all([
    loadInstructorDirectory(),
    getPrivateLessonExceptionRepository().findByLessonIds(lessons.map((lesson) => lesson.id)),
    resolveStudioClosedDateKeys(range.from, lastKey),
    loadAccounts(lessons.map((lesson) => lesson.userId)),
  ]);
  return lessons
    .flatMap((lesson) =>
      expandPrivateLesson(lesson, exceptions.filter((exception) => exception.lessonId === lesson.id), closedDates, range.from, lastKey).map(
        (occurrence) => {
          const account = accounts.get(lesson.userId);
          return {
            ...toOccurrenceDto(occurrence, clock),
            title: lesson.title,
            attendee: lesson.attendee,
            accountName: account ? fullName(account) : undefined,
            instructor: instructorOf(lesson.instructorStaffId, directory),
            rateCents: lesson.rateCents,
          };
        },
      ),
    )
    .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
};

// ---- Writes ------------------------------------------------------------------------------------

const requireLesson = async (id: string): Promise<PrivateLessonEntity> => {
  const lesson = await getPrivateLessonRepository().findById(id);
  if (!lesson) throw NotFoundError('Private lesson not found');
  return lesson;
};

const requireDateKey = (dateKey: string, label: string): Date => {
  if (!isValidDateKey(dateKey)) throw ValidationError(`${label} isn’t a real date.`);
  return dateKeyToUtc(dateKey);
};

const toSchedule = (body: PrivateLessonScheduleBody): PrivateLessonSchedule =>
  body.kind === 'weekly'
    ? {
        kind: 'weekly',
        weekday: body.weekday,
        startTime: body.startTime,
        endTime: body.endTime,
        startDate: requireDateKey(body.startDate, 'The start date'),
        ...(body.endDate ? { endDate: requireDateKey(body.endDate, 'The end date') } : {}),
      }
    : { kind: 'once', date: requireDateKey(body.date, 'The date'), startTime: body.startTime, endTime: body.endTime };

const resolveAttendee = async (account: UserEntity, ref: CreatePrivateLessonBody['attendee']): Promise<ClassAttendee> => {
  const attendee = await describeAttendee(account.id, fullName(account), ref);
  if (!attendee) throw ValidationError('Choose a student on this account, or the account holder.');
  return attendee;
};

const requireInstructor = async (staffId: string): Promise<void> => {
  if (!(await loadInstructorDirectory()).has(staffId)) throw ValidationError('Choose an instructor from the staff list.');
};

export const createPrivateLesson = async (body: CreatePrivateLessonBody, actorUserId: string) => {
  const account = await getUserRepository().findById(body.userId);
  if (!account) throw NotFoundError('Account not found');
  await requireInstructor(body.instructorStaffId);
  const input: CreatePrivateLessonInput = {
    userId: account.id,
    attendee: await resolveAttendee(account, body.attendee),
    instructorStaffId: body.instructorStaffId,
    title: body.title,
    schedule: toSchedule(body.schedule),
    rateCents: body.rateCents,
    ...(body.notes ? { notes: body.notes } : {}),
    createdByUserId: actorUserId,
  };
  return getPrivateLessonAdmin((await getPrivateLessonRepository().create(input)).id);
};

const sameSchedule = (a: PrivateLessonSchedule, b: PrivateLessonSchedule): boolean =>
  JSON.stringify(toScheduleDto(a)) === JSON.stringify(toScheduleDto(b));

// A lesson that has already met keeps the dates it was taught on: a new day or time applies from
// today on, so past dates under the new schedule are never billed as if they'd happened.
const scheduleFromToday = (schedule: PrivateLessonSchedule, clock: StudioClock): PrivateLessonSchedule => {
  if (schedule.kind === 'once') {
    if (toDateKey(schedule.date) < clock.todayKey) throw ValidationError('A lesson can’t be moved to a date that has passed.');
    return schedule;
  }
  const today = dateKeyToUtc(clock.todayKey);
  if (schedule.endDate && schedule.endDate < today) throw ValidationError('The new end date has already passed. End the lesson instead.');
  return schedule.startDate < today ? { ...schedule, startDate: today } : schedule;
};

export const updatePrivateLesson = async (id: string, body: UpdatePrivateLessonBody) => {
  const lesson = await requireLesson(id);
  const account = await getUserRepository().findById(lesson.userId);
  if (!account) throw NotFoundError('Account not found');
  await requireInstructor(body.instructorStaffId);

  // Bill everything already taught at the old rate and schedule before either changes.
  await accruePrivateLessonCharges(lesson.userId);
  const clock = await loadClock();
  const requested = toSchedule(body.schedule);
  const hasStarted = privateLessonFirstDateKey(lesson) < clock.todayKey;
  const schedule = hasStarted && !sameSchedule(requested, lesson.schedule) ? scheduleFromToday(requested, clock) : requested;

  const updated = await getPrivateLessonRepository().update(id, {
    attendee: await resolveAttendee(account, body.attendee),
    instructorStaffId: body.instructorStaffId,
    title: body.title,
    schedule,
    rateCents: body.rateCents,
    notes: body.notes ? body.notes : null,
  });
  if (!updated) throw NotFoundError('Private lesson not found');
  return getPrivateLessonAdmin(updated.id);
};

// Nothing after lastDate (default: today) happens or is charged. Lessons already charged stay on
// the ledger; staff void one by hand to waive it.
export const endPrivateLesson = async (id: string, lastDate: string | undefined) => {
  await requireLesson(id);
  const clock = await loadClock();
  const ended = await getPrivateLessonRepository().end(id, requireDateKey(lastDate ?? clock.todayKey, 'The last date'));
  if (!ended) throw NotFoundError('Private lesson not found');
  return getPrivateLessonAdmin(ended.id);
};

// Only a lesson that was never charged can be deleted, so the ledger never points at nothing.
export const deletePrivateLesson = async (id: string): Promise<void> => {
  const lesson = await requireLesson(id);
  await accruePrivateLessonCharges(lesson.userId);
  if ((await getLedgerEntryRepository().findBilledLessonDates(id)).length > 0) {
    throw ConflictError('This lesson has charges on the family’s ledger. End it instead so its history stays.');
  }
  await getPrivateLessonExceptionRepository().deleteByLessonId(id);
  if (!(await getPrivateLessonRepository().delete(id))) throw NotFoundError('Private lesson not found');
};

const findException = async (lessonId: string, date: Date): Promise<PrivateLessonExceptionEntity | undefined> =>
  (await getPrivateLessonExceptionRepository().findByLessonIds([lessonId])).find((exception) => exception.date.getTime() === date.getTime());

// An occurrence can only change before it starts - both at its scheduled time and wherever it was
// moved to. A lesson that has happened is billed; staff void the charge to waive it.
const requireNotStarted = async (lesson: PrivateLessonEntity, dateKey: string, clock: StudioClock): Promise<Date> => {
  const date = requireDateKey(dateKey, 'The lesson date');
  if (!isPrivateLessonScheduledOn(lesson, dateKey)) throw ValidationError('This lesson isn’t scheduled on that date.');
  const existing = await findException(lesson.id, date);
  const effective =
    existing?.kind === 'moved' && existing.newDate && existing.newStartTime
      ? startsAt(toDateKey(existing.newDate), existing.newStartTime, clock)
      : startsAt(dateKey, lesson.schedule.startTime, clock);
  if (startsAt(dateKey, lesson.schedule.startTime, clock) <= clock.now || effective <= clock.now) {
    throw ConflictError('This lesson has already started, so it can’t be changed. Void its charge in Accounts to waive it.');
  }
  return date;
};

export const setPrivateLessonException = async (lessonId: string, body: PrivateLessonExceptionBody, actorUserId: string) => {
  const lesson = await requireLesson(lessonId);
  const clock = await loadClock();
  const date = await requireNotStarted(lesson, body.date, clock);
  if (body.kind === 'moved') {
    const newDate = requireDateKey(body.newDate, 'The new date');
    if (startsAt(body.newDate, body.newStartTime, clock) <= clock.now) throw ValidationError('Move the lesson to a time that hasn’t passed.');
    await getPrivateLessonExceptionRepository().upsert({
      lessonId,
      date,
      kind: 'moved',
      newDate,
      newStartTime: body.newStartTime,
      newEndTime: body.newEndTime,
      createdByUserId: actorUserId,
    });
  } else {
    await getPrivateLessonExceptionRepository().upsert({ lessonId, date, kind: 'cancelled', createdByUserId: actorUserId });
  }
  return getPrivateLessonAdmin(lessonId);
};

// Puts the occurrence back on its scheduled date and time.
export const clearPrivateLessonException = async (lessonId: string, dateKey: string) => {
  const lesson = await requireLesson(lessonId);
  const date = await requireNotStarted(lesson, dateKey, await loadClock());
  if (!(await getPrivateLessonExceptionRepository().deleteOne(lessonId, date))) throw NotFoundError('That date has no change to undo.');
  return getPrivateLessonAdmin(lessonId);
};
