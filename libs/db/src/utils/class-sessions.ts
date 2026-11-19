import { DAYS_OF_WEEK } from '../contracts/class-section.contract';
import type { DayOfWeek } from '../contracts/class-section.contract';
import type { SemesterEntity } from '../contracts/school-year.contract';

// Calendar dates travel as "YYYY-MM-DD" keys and are stored as UTC midnight, so they never shift a
// day between server and browser zones.

const DAY_MS = 86_400_000;

export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const toDateKey = (date: Date): string => date.toISOString().slice(0, 10);

export const dateKeyToUtc = (dateKey: string): Date => new Date(`${dateKey}T00:00:00.000Z`);

export const isValidDateKey = (value: string): boolean => DATE_KEY_PATTERN.test(value) && toDateKey(dateKeyToUtc(value)) === value;

export const addDaysToKey = (dateKey: string, days: number): string => toDateKey(new Date(dateKeyToUtc(dateKey).getTime() + days * DAY_MS));

export const countDaysBetweenKeys = (fromKey: string, toKey: string): number =>
  Math.round((dateKeyToUtc(toKey).getTime() - dateKeyToUtc(fromKey).getTime()) / DAY_MS);

// Every date key with fromKey <= key <= toKey.
export const eachDateKey = (fromKey: string, toKey: string): string[] =>
  fromKey > toKey ? [] : Array.from({ length: countDaysBetweenKeys(fromKey, toKey) + 1 }, (_, offset) => addDaysToKey(fromKey, offset));

const maxKey = (a: string, b: string): string => (a > b ? a : b);
const minKey = (a: string, b: string): string => (a < b ? a : b);

export const dayOfWeekOfKey = (dateKey: string): DayOfWeek => DAYS_OF_WEEK[(dateKeyToUtc(dateKey).getUTCDay() + 6) % 7] as DayOfWeek;

export interface ClosureSource {
  isStudioClosed: boolean;
}

// Dates in [fromKey, lastKey] the studio is closed: holidays it hasn't opened for, plus closure
// entries (which can span several days).
export const studioClosedDateKeys = (
  holidays: (ClosureSource & { date: string })[],
  entries: (ClosureSource & { startDate: Date; endDate: Date })[],
  fromKey: string,
  lastKey: string,
): Set<string> =>
  new Set([
    ...holidays.filter((holiday) => holiday.isStudioClosed).map((holiday) => holiday.date),
    ...entries
      .filter((entry) => entry.isStudioClosed)
      .flatMap((entry) => eachDateKey(maxKey(toDateKey(entry.startDate), fromKey), minKey(toDateKey(entry.endDate), lastKey))),
  ]);

// The dates a section meets in [fromKey, lastKey]: its weekdays inside each of its semesters,
// minus closed dates.
export const sectionSessionDateKeys = (
  daysOfWeek: DayOfWeek[],
  semesters: Pick<SemesterEntity, 'startDate' | 'endDate'>[],
  fromKey: string,
  lastKey: string,
  closedDates: Set<string>,
): string[] =>
  semesters
    .flatMap((semester) => eachDateKey(maxKey(toDateKey(semester.startDate), fromKey), minKey(toDateKey(semester.endDate), lastKey)))
    .filter((dateKey) => daysOfWeek.includes(dayOfWeekOfKey(dateKey)) && !closedDates.has(dateKey));
