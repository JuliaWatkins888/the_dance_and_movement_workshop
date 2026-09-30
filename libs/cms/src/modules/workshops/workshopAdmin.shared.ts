import type { WorkshopDto } from '@inithium/api-client';

// Calendar dates are stored as UTC midnight - format in UTC so they never shift a day.
const dayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
export const formatWorkshopDay = (iso: string): string => dayFormatter.format(new Date(iso));

// Past once its last day has ended.
export const isPastWorkshop = (workshop: WorkshopDto, now: Date): boolean => {
  const last = workshop.days[workshop.days.length - 1];
  return last !== undefined && new Date(last.endsAt) <= now;
};
