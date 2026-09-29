import type { CatalogCourseDto, CatalogSectionDto, ClassPlanOptionDto, InstructorSummaryDto } from '@inithium/api-client';
import type { CourseLevel, DayOfWeek } from '@inithium/db';

// Monday-first display order - not imported from @inithium/db's own DAYS_OF_WEEK (a runtime
// value), since apps/web never pulls runtime code from that package (it depends on mongoose).
export const WEEKDAY_ORDER: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const formatTime12h = (time: string): string => {
  const [hoursRaw, minutes] = time.split(':');
  const hours = Number(hoursRaw);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${minutes} ${period}`;
};

export const formatTimeRange = (startTime: string, endTime: string): string =>
  `${formatTime12h(startTime)} – ${formatTime12h(endTime)}`;

export const formatDays = (days: DayOfWeek[]): string => days.map((day) => `${day}s`).join(' & ');

export const formatCents = (cents: number): string => {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
};

export const formatAgeRange = (min?: number, max?: number): string => {
  if (min === undefined && max === undefined) return 'All ages';
  if (max === undefined) return `Ages ${min}+`;
  if (min === undefined) return `Up to age ${max}`;
  return `Ages ${min}–${max}`;
};

export const LEVEL_LABELS: Record<CourseLevel, string> = {
  beginner: 'Beginner · 0–3 years experience',
  intermediate: 'Intermediate · 4+ years experience',
};

// Stored as UTC midnight of a calendar date - formatted in UTC so it never shifts a day.
const shortDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const formatShortDate = (iso: string): string => shortDateFormatter.format(new Date(iso));
export const formatDateRange = (startIso: string, endIso: string): string => `${formatShortDate(startIso)} – ${formatShortDate(endIso)}`;

export const formatInstructors = (instructors: InstructorSummaryDto[]): string =>
  instructors.length > 0 ? instructors.map((instructor) => instructor.name).join(' & ') : 'Instructor TBA';

export const formatOpenings = (openings: number): string =>
  openings <= 0 ? 'Class full' : `${openings} spot${openings === 1 ? '' : 's'} left`;

export const planTitle = (plan: ClassPlanOptionDto): string => {
  if (plan.kind === 'monthly') return 'Monthly';
  if (plan.kind === 'semester') return plan.semesterName ?? 'Semester';
  return 'Full year';
};

export const planPriceLabel = (plan: ClassPlanOptionDto): string =>
  plan.kind === 'monthly' ? `${formatCents(plan.amountCents)}/mo` : formatCents(plan.amountCents);

export const planDetail = (plan: ClassPlanOptionDto): string => {
  if (plan.kind === 'monthly') return 'Billed each month you attend';
  const range = plan.startDate && plan.endDate ? `${formatDateRange(plan.startDate, plan.endDate)} · ` : '';
  return `${range}${plan.months} months, paid once · save ${plan.discountPercent}%`;
};

export const courseMatchesAge = (course: CatalogCourseDto, age: number): boolean =>
  (course.minAgeYears ?? 0) <= age && age <= (course.maxAgeYears ?? Number.POSITIVE_INFINITY);

export const sectionMatchesDay = (section: CatalogSectionDto, day: DayOfWeek): boolean => section.daysOfWeek.includes(day);

export const runsSingleSemester = (section: CatalogSectionDto): boolean => section.semesters.length === 1;
