import {
  DAYS_OF_WEEK,
  listCalendarEntriesOverlapping,
  listClassSections,
  listCourses,
  listEvents,
  listFederalHolidaysBetween,
  listHolidayOpenings,
  listPrograms,
  listSchoolYears,
  listWorkshops,
  resolveSectionSemesters,
} from '@inithium/db';
import type { CalendarEntryEntity, ClassSectionEntity, CourseEntity, EventEntity, FederalHoliday, WorkshopEntity } from '@inithium/db';
import { loadInstructorDirectory } from './class-catalog.service';
import type { InstructorDirectory } from './class-catalog.service';

const DAY_MS = 86_400_000;

export type CalendarItemKind = 'class' | 'workshop' | 'event' | 'holiday' | 'entry';

// What the public legend toggles - holidays share a bucket with admin closures.
export type CalendarItemCategory = 'classes' | 'workshops' | 'events' | 'closures' | 'other';

export interface CalendarItemLocation {
  isAtStudio: boolean;
  venueName?: string;
  venueAddress?: string;
}

// Times are studio wall-clock and carry no offset: "YYYY-MM-DD" for an all-day item (its end is
// exclusive), otherwise "YYYY-MM-DDTHH:mm".
export interface CalendarItemDto {
  id: string;
  kind: CalendarItemKind;
  category: CalendarItemCategory;
  title: string;
  subtitle?: string;
  start: string;
  end?: string;
  allDay: boolean;
  // The public page the item opens; absent for holidays and admin entries, which open in place.
  href?: string;
  // Holidays and admin entries only.
  isStudioClosed?: boolean;
  description?: string;
  location?: CalendarItemLocation;
  linkUrl?: string;
}

export interface CalendarRange {
  from: string;
  // Exclusive.
  to: string;
}

// ---- Date keys -------------------------------------------------------------------------------

const toUtcDate = (dateKey: string): Date => new Date(`${dateKey}T00:00:00.000Z`);

export const toDateKey = (date: Date): string => date.toISOString().slice(0, 10);

const addDays = (dateKey: string, days: number): string => toDateKey(new Date(toUtcDate(dateKey).getTime() + days * DAY_MS));

export const countDays = (fromKey: string, toKey: string): number => Math.round((toUtcDate(toKey).getTime() - toUtcDate(fromKey).getTime()) / DAY_MS);

// Every date key with fromKey <= key <= toKey.
const eachDateKey = (fromKey: string, toKey: string): string[] =>
  fromKey > toKey ? [] : Array.from({ length: countDays(fromKey, toKey) + 1 }, (_, offset) => addDays(fromKey, offset));

const maxKey = (a: string, b: string): string => (a > b ? a : b);
const minKey = (a: string, b: string): string => (a < b ? a : b);

const dayOfWeekOf = (dateKey: string) => DAYS_OF_WEEK[(toUtcDate(dateKey).getUTCDay() + 6) % 7];

// ---- Holidays & closures ---------------------------------------------------------------------

export interface ResolvedHoliday extends FederalHoliday {
  isStudioClosed: boolean;
}

export const resolveHolidays = async (fromKey: string, lastKey: string): Promise<ResolvedHoliday[]> => {
  const openings = await listHolidayOpenings(toUtcDate(fromKey), toUtcDate(lastKey));
  const openDates = new Set(openings.map((opening) => toDateKey(opening.date)));
  return listFederalHolidaysBetween(fromKey, lastKey).map((holiday) => ({ ...holiday, isStudioClosed: !openDates.has(holiday.date) }));
};

const closedDateKeys = (holidays: ResolvedHoliday[], entries: CalendarEntryEntity[], fromKey: string, lastKey: string): Set<string> =>
  new Set([
    ...holidays.filter((holiday) => holiday.isStudioClosed).map((holiday) => holiday.date),
    ...entries
      .filter((entry) => entry.isStudioClosed)
      .flatMap((entry) => eachDateKey(maxKey(toDateKey(entry.startDate), fromKey), minKey(toDateKey(entry.endDate), lastKey))),
  ]);

const toHolidayItem = (holiday: ResolvedHoliday): CalendarItemDto => ({
  id: `holiday:${holiday.date}`,
  kind: 'holiday',
  category: 'closures',
  title: holiday.name,
  start: holiday.date,
  end: addDays(holiday.date, 1),
  allDay: true,
  isStudioClosed: holiday.isStudioClosed,
});

const toEntryItem = (entry: CalendarEntryEntity): CalendarItemDto => {
  const startKey = toDateKey(entry.startDate);
  const endKey = toDateKey(entry.endDate);
  const isTimed = Boolean(entry.startTime && entry.endTime);
  return {
    id: `entry:${entry.id}`,
    kind: 'entry',
    category: entry.isStudioClosed ? 'closures' : 'other',
    title: entry.title,
    start: isTimed ? `${startKey}T${entry.startTime}` : startKey,
    end: isTimed ? `${endKey}T${entry.endTime}` : addDays(endKey, 1),
    allDay: !isTimed,
    isStudioClosed: entry.isStudioClosed,
    ...(entry.description ? { description: entry.description } : {}),
    location: {
      isAtStudio: entry.isAtStudio,
      ...(!entry.isAtStudio && entry.venueName ? { venueName: entry.venueName } : {}),
      ...(!entry.isAtStudio && entry.venueAddress ? { venueAddress: entry.venueAddress } : {}),
    },
    ...(entry.linkUrl ? { linkUrl: entry.linkUrl } : {}),
  };
};

// ---- Classes ---------------------------------------------------------------------------------

const formatInstructorNames = (staffIds: string[], directory: InstructorDirectory): string | undefined => {
  const names = staffIds.flatMap((id) => {
    const name = directory.get(id)?.name;
    return name ? [name] : [];
  });
  return names.length > 0 ? `with ${names.join(' & ')}` : undefined;
};

// Classes meet on the section's weekdays across each of its semesters' date ranges, skipping any
// date the studio is closed.
const loadClassItems = async (fromKey: string, lastKey: string, closedDates: Set<string>): Promise<CalendarItemDto[]> => {
  const [programs, courses, sections, schoolYears, directory] = await Promise.all([
    listPrograms(),
    listCourses(),
    listClassSections(),
    listSchoolYears(),
    loadInstructorDirectory(),
  ]);
  const publishedProgramIds = new Set(programs.filter((program) => program.isPublished).map((program) => program.id));
  const coursesById = new Map<string, CourseEntity>(
    courses.filter((course) => course.isPublished && publishedProgramIds.has(course.programId)).map((course) => [course.id, course]),
  );
  const schoolYearsById = new Map(schoolYears.filter((year) => year.isPublished).map((year) => [year.id, year]));

  const sessionsOf = (section: ClassSectionEntity): CalendarItemDto[] => {
    const course = coursesById.get(section.courseId);
    const schoolYear = schoolYearsById.get(section.schoolYearId);
    if (!section.isPublished || !course || !schoolYear) return [];
    const subtitle = formatInstructorNames(section.instructorStaffIds, directory);

    return resolveSectionSemesters(section.semesterIds, schoolYear.semesters)
      .flatMap((semester) => eachDateKey(maxKey(toDateKey(semester.startDate), fromKey), minKey(toDateKey(semester.endDate), lastKey)))
      .filter((dateKey) => section.daysOfWeek.includes(dayOfWeekOf(dateKey)) && !closedDates.has(dateKey))
      .map((dateKey) => ({
        id: `class:${section.id}:${dateKey}`,
        kind: 'class' as const,
        category: 'classes' as const,
        title: course.name,
        ...(subtitle ? { subtitle } : {}),
        start: `${dateKey}T${section.startTime}`,
        end: `${dateKey}T${section.endTime}`,
        allDay: false,
        href: `/classes/${course.slug}?section=${section.id}`,
      }));
  };

  return sections.flatMap(sessionsOf);
};

// ---- Workshops & events ----------------------------------------------------------------------

const inRange = (dateKey: string, fromKey: string, lastKey: string): boolean => dateKey >= fromKey && dateKey <= lastKey;

const toWorkshopItems = (workshop: WorkshopEntity, fromKey: string, lastKey: string): CalendarItemDto[] =>
  workshop.days.flatMap((day, index) => {
    const dateKey = toDateKey(day.date);
    if (!inRange(dateKey, fromKey, lastKey)) return [];
    return [
      {
        id: `workshop:${workshop.id}:${day.id}`,
        kind: 'workshop' as const,
        category: 'workshops' as const,
        title: workshop.title,
        ...(workshop.days.length > 1 ? { subtitle: `Day ${index + 1} of ${workshop.days.length}` } : {}),
        start: `${dateKey}T${day.startTime}`,
        end: `${dateKey}T${day.endTime}`,
        allDay: false,
        href: `/workshops/${workshop.slug}`,
      },
    ];
  });

const toEventItem = (event: EventEntity): CalendarItemDto => {
  const dateKey = toDateKey(event.date);
  return {
    id: `event:${event.id}`,
    kind: 'event',
    category: 'events',
    title: event.title,
    start: `${dateKey}T${event.startTime}`,
    ...(event.endTime ? { end: `${dateKey}T${event.endTime}` } : {}),
    allDay: false,
    href: `/events/${event.slug}`,
  };
};

// ---- Public feed -----------------------------------------------------------------------------

// Everything published that happens in [from, to): holidays, admin entries, class sessions,
// workshop days, and events. Closures only ever remove class sessions - a workshop or event the
// admin scheduled on a closed date still runs.
export const buildPublicCalendar = async ({ from, to }: CalendarRange): Promise<CalendarItemDto[]> => {
  const lastKey = addDays(to, -1);
  const [holidays, entries, workshops, events] = await Promise.all([
    resolveHolidays(from, lastKey),
    listCalendarEntriesOverlapping(toUtcDate(from), toUtcDate(lastKey)).then((all) => all.filter((entry) => entry.isPublished)),
    listWorkshops(),
    listEvents(),
  ]);
  const classItems = await loadClassItems(from, lastKey, closedDateKeys(holidays, entries, from, lastKey));

  return [
    ...holidays.map(toHolidayItem),
    ...entries.map(toEntryItem),
    ...classItems,
    ...workshops.filter((workshop) => workshop.isPublished).flatMap((workshop) => toWorkshopItems(workshop, from, lastKey)),
    ...events.filter((event) => event.isPublished && inRange(toDateKey(event.date), from, lastKey)).map(toEventItem),
  ];
};
