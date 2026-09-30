import type { PublicWorkshopDayDto, PublicWorkshopDto, WorkshopInstructorDto } from '@inithium/api-client';
import { formatCents } from '../classes/classFormat';

// Calendar dates are stored as UTC midnight - formatted in UTC so they never shift a day.
const longDayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const shortDayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const monthDayFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const monthDayYearFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export const formatDayLong = (iso: string): string => longDayFormatter.format(new Date(iso));
export const formatDayShort = (iso: string): string => shortDayFormatter.format(new Date(iso));

// "Oct 12, 2026" for a single day, otherwise "Oct 12 – Oct 14, 2026".
export const formatDateSpan = (days: Pick<PublicWorkshopDayDto, 'date'>[]): string => {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return '';
  if (first.date === last.date) return monthDayYearFormatter.format(new Date(first.date));
  return `${monthDayFormatter.format(new Date(first.date))} – ${monthDayYearFormatter.format(new Date(last.date))}`;
};

export const formatDayCount = (count: number): string => `${count} day${count === 1 ? '' : 's'}`;

export const formatWorkshopInstructors = (instructors: WorkshopInstructorDto[]): string =>
  instructors.length > 0 ? instructors.map((instructor) => instructor.name).join(' & ') : 'Instructor TBA';

export const hasFullWorkshopDiscount = (workshop: PublicWorkshopDto): boolean =>
  workshop.days.length > 1 && workshop.fullWorkshopDiscountPercent > 0;

// What the chosen days cost - the whole-workshop price once every day is picked.
export const selectionPriceCents = (workshop: PublicWorkshopDto, selectedCount: number): number =>
  selectedCount > 0 && selectedCount === workshop.days.length ? workshop.fullWorkshopPriceCents : workshop.pricePerDayCents * selectedCount;

export const fullWorkshopSummary = (workshop: PublicWorkshopDto): string =>
  `All ${workshop.days.length} days: ${formatCents(workshop.fullWorkshopPriceCents)} (save ${workshop.fullWorkshopDiscountPercent}%)`;

export const availabilityLabel = (workshop: PublicWorkshopDto): string => {
  if (workshop.status === 'past') return 'Ended';
  if (workshop.status === 'in_progress') return 'In progress · registration closed';
  const openDays = workshop.days.filter((day) => day.openings > 0);
  if (openDays.length === 0) return 'Full';
  if (openDays.length < workshop.days.length) return 'Some days full';
  const fewest = Math.min(...openDays.map((day) => day.openings));
  return `${fewest} spot${fewest === 1 ? '' : 's'} left`;
};

export interface WorkshopFilters {
  readonly search: string;
  readonly age?: number;
  // "YYYY-MM-DD" - a workshop matches when any of its days falls in the range.
  readonly from?: string;
  readonly to?: string;
}

const matchesSearch = (workshop: PublicWorkshopDto, query: string): boolean => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const haystack = [workshop.title, ...workshop.styles, ...workshop.instructors.map((instructor) => instructor.name)];
  return haystack.join(' ').toLowerCase().includes(trimmed);
};

const matchesAge = (workshop: PublicWorkshopDto, age: number): boolean =>
  (workshop.minAgeYears ?? 0) <= age && age <= (workshop.maxAgeYears ?? Number.POSITIVE_INFINITY);

const matchesDates = (workshop: PublicWorkshopDto, from?: string, to?: string): boolean =>
  workshop.days.some((day) => {
    const date = day.date.slice(0, 10);
    return (!from || date >= from) && (!to || date <= to);
  });

export const filterWorkshops = (workshops: PublicWorkshopDto[], filters: WorkshopFilters): PublicWorkshopDto[] =>
  workshops.filter(
    (workshop) =>
      matchesSearch(workshop, filters.search) &&
      (filters.age === undefined || matchesAge(workshop, filters.age)) &&
      matchesDates(workshop, filters.from, filters.to),
  );
