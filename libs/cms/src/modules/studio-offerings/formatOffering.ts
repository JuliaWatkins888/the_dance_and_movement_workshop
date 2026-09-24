import type { SemesterSummaryDto } from '@inithium/api-client';

// "Full year" when a course/class runs in every semester its year has, else the names of the
// semester(s) it does run in (e.g. "Summer/Fall 2026").
export const formatSemesterScope = (offering: { spansFullYear: boolean; semesters: SemesterSummaryDto[] }): string =>
  offering.spansFullYear ? 'Full year' : offering.semesters.map((semester) => semester.name).join(', ') || 'No semester';

export const formatCurrency = (amount: number): string => `$${amount % 1 === 0 ? amount : amount.toFixed(2)}`;

export const formatTime12h = (time: string): string => {
  const [hoursRaw, minutes] = time.split(':');
  const hours = Number(hoursRaw);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${minutes} ${period}`;
};

// "Tue/Thu 5:00 PM–6:00 PM"
export const formatSchedule = (daysOfWeek: readonly string[], startTime: string, endTime: string): string =>
  `${daysOfWeek.map((day) => day.slice(0, 3)).join('/')} ${formatTime12h(startTime)}–${formatTime12h(endTime)}`;

export const formatAgeRange = (min?: number, max?: number): string => {
  if (min === undefined && max === undefined) return 'All ages';
  if (min !== undefined && max === undefined) return `Ages ${min}+`;
  if (min === undefined && max !== undefined) return `Up to age ${max}`;
  return `Ages ${min}–${max}`;
};
