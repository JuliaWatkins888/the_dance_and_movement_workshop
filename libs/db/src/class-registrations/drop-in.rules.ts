import { getTimeSettings, listCalendarEntriesOverlapping, listHolidayOpenings } from '../index';
import type { ClassSectionEntity } from '../contracts/class-section.contract';
import type { SemesterEntity } from '../contracts/school-year.contract';
import { dateKeyToUtc, sectionSessionDateKeys, studioClosedDateKeys, toDateKey } from '../utils/class-sessions';
import { listFederalHolidaysBetween } from '../utils/us-federal-holidays';
import type { FederalHoliday } from '../utils/us-federal-holidays';
import { zonedDateKey, zonedWallTimeToUtc } from '../utils/zoned-time';

export interface ResolvedHoliday extends FederalHoliday {
  isStudioClosed: boolean;
}

// Federal holidays in [fromKey, lastKey] - closed unless an admin opened the studio that day.
export const resolveHolidays = async (fromKey: string, lastKey: string): Promise<ResolvedHoliday[]> => {
  const openings = await listHolidayOpenings(dateKeyToUtc(fromKey), dateKeyToUtc(lastKey));
  const openDates = new Set(openings.map((opening) => toDateKey(opening.date)));
  return listFederalHolidaysBetween(fromKey, lastKey).map((holiday) => ({ ...holiday, isStudioClosed: !openDates.has(holiday.date) }));
};

// Same closures the public calendar hides classes for: closed holidays and published closure entries.
export const resolveStudioClosedDateKeys = async (fromKey: string, lastKey: string): Promise<Set<string>> => {
  const [holidays, entries] = await Promise.all([
    resolveHolidays(fromKey, lastKey),
    listCalendarEntriesOverlapping(dateKeyToUtc(fromKey), dateKeyToUtc(lastKey)),
  ]);
  return studioClosedDateKeys(
    holidays,
    entries.filter((entry) => entry.isPublished),
    fromKey,
    lastKey,
  );
};

type SectionSchedule = Pick<ClassSectionEntity, 'daysOfWeek' | 'startTime'>;

// A drop-in for a date can be bought until the class starts, in studio local time.
const startsAfter = (dateKey: string, section: SectionSchedule, timeZone: string, now: Date): boolean =>
  zonedWallTimeToUtc(`${dateKey}T${section.startTime}`, timeZone) > now;

// The section's class dates in [fromKey, lastKey] still open to drop-ins: a scheduled weekday
// inside one of its semesters, the studio open, and the class not yet started.
export const listOpenDropInDates = async (
  section: SectionSchedule,
  semesters: Pick<SemesterEntity, 'startDate' | 'endDate'>[],
  fromKey: string,
  lastKey: string,
  now: Date,
): Promise<string[]> => {
  const { timezone } = await getTimeSettings();
  const todayKey = zonedDateKey(now, timezone);
  const startKey = fromKey > todayKey ? fromKey : todayKey;
  if (startKey > lastKey) return [];
  const closed = await resolveStudioClosedDateKeys(startKey, lastKey);
  return sectionSessionDateKeys(section.daysOfWeek, semesters, startKey, lastKey, closed).filter((dateKey) =>
    startsAfter(dateKey, section, timezone, now),
  );
};

export type DropInDateCheck = 'ok' | 'not_scheduled' | 'closed' | 'started';

// Why one date can or can't take a drop-in, so checkout can say which.
export const checkDropInDate = async (
  section: SectionSchedule,
  semesters: Pick<SemesterEntity, 'startDate' | 'endDate'>[],
  dateKey: string,
  now: Date,
): Promise<DropInDateCheck> => {
  if (sectionSessionDateKeys(section.daysOfWeek, semesters, dateKey, dateKey, new Set()).length === 0) return 'not_scheduled';
  if ((await resolveStudioClosedDateKeys(dateKey, dateKey)).has(dateKey)) return 'closed';
  const { timezone } = await getTimeSettings();
  return startsAfter(dateKey, section, timezone, now) ? 'ok' : 'started';
};
