import type { PrivateLessonEntity, PrivateLessonExceptionEntity } from '../contracts/private-lesson.contract';
import { dayOfWeekOfKey, eachDateKey, toDateKey } from './class-sessions';

export type PrivateLessonOccurrenceStatus = 'scheduled' | 'cancelled';

export interface PrivateLessonOccurrence {
  lessonId: string;
  // The date the schedule puts it on. It stays the same when staff move it, so it identifies the
  // occurrence (and its ledger charge).
  scheduledDate: string;
  // Where it actually happens - differs from scheduledDate only when moved.
  date: string;
  startTime: string;
  endTime: string;
  status: PrivateLessonOccurrenceStatus;
  isMoved: boolean;
}

export type ExpandableLesson = Pick<PrivateLessonEntity, 'id' | 'schedule' | 'endedOn'>;
export type LessonException = Pick<PrivateLessonExceptionEntity, 'date' | 'kind' | 'newDate' | 'newStartTime' | 'newEndTime'>;

const maxKey = (a: string, b: string): string => (a > b ? a : b);
const minKey = (a: string, b: string): string => (a < b ? a : b);

// The first date the lesson can meet.
export const privateLessonFirstDateKey = (lesson: Pick<PrivateLessonEntity, 'schedule'>): string =>
  toDateKey(lesson.schedule.kind === 'weekly' ? lesson.schedule.startDate : lesson.schedule.date);

// Dates in [fromKey, lastKey] the schedule puts a lesson on, before closures and exceptions. An
// ended lesson stops after its endedOn date.
export const privateLessonDateKeys = (lesson: ExpandableLesson, fromKey: string, lastKey: string): string[] => {
  const cap = lesson.endedOn ? minKey(lastKey, toDateKey(lesson.endedOn)) : lastKey;
  const { schedule } = lesson;
  if (schedule.kind === 'once') {
    const dateKey = toDateKey(schedule.date);
    return dateKey >= fromKey && dateKey <= cap ? [dateKey] : [];
  }
  const start = maxKey(toDateKey(schedule.startDate), fromKey);
  const end = schedule.endDate ? minKey(toDateKey(schedule.endDate), cap) : cap;
  return eachDateKey(start, end).filter((dateKey) => dayOfWeekOfKey(dateKey) === schedule.weekday);
};

export const isPrivateLessonScheduledOn = (lesson: ExpandableLesson, dateKey: string): boolean =>
  privateLessonDateKeys(lesson, dateKey, dateKey).length > 0;

// Every occurrence that happens in [fromKey, lastKey], sorted by when it happens. A studio closure
// skips an occurrence, the same as a class, unless staff moved it (a make-up). Cancelled ones are
// kept, marked, so staff can see and undo them. Occurrences moved into the range from outside it
// are included, and ones moved out of it aren't.
export const expandPrivateLesson = (
  lesson: ExpandableLesson,
  exceptions: LessonException[],
  closedDates: Set<string>,
  fromKey: string,
  lastKey: string,
): PrivateLessonOccurrence[] => {
  const { startTime, endTime } = lesson.schedule;
  const exceptionByDate = new Map(exceptions.map((exception) => [toDateKey(exception.date), exception]));

  const resolve = (scheduledDate: string): PrivateLessonOccurrence | null => {
    const base: PrivateLessonOccurrence = {
      lessonId: lesson.id,
      scheduledDate,
      date: scheduledDate,
      startTime,
      endTime,
      status: 'scheduled',
      isMoved: false,
    };
    const exception = exceptionByDate.get(scheduledDate);
    if (exception?.kind === 'moved') {
      return {
        ...base,
        date: exception.newDate ? toDateKey(exception.newDate) : scheduledDate,
        startTime: exception.newStartTime ?? startTime,
        endTime: exception.newEndTime ?? endTime,
        isMoved: true,
      };
    }
    if (closedDates.has(scheduledDate)) return null;
    return exception?.kind === 'cancelled' ? { ...base, status: 'cancelled' } : base;
  };

  const inRange = (dateKey: string): boolean => dateKey >= fromKey && dateKey <= lastKey;
  const movedIn = exceptions.flatMap((exception) => {
    const scheduledDate = toDateKey(exception.date);
    const isMovedIn =
      exception.kind === 'moved' &&
      exception.newDate !== undefined &&
      inRange(toDateKey(exception.newDate)) &&
      !inRange(scheduledDate) &&
      isPrivateLessonScheduledOn(lesson, scheduledDate);
    return isMovedIn ? [scheduledDate] : [];
  });

  return [...privateLessonDateKeys(lesson, fromKey, lastKey), ...movedIn]
    .flatMap((scheduledDate) => {
      const occurrence = resolve(scheduledDate);
      return occurrence && inRange(occurrence.date) ? [occurrence] : [];
    })
    .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
};
