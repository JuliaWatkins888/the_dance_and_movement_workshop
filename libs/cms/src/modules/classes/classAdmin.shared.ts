import type { DayOfWeek } from '@inithium/db';

// Not imported at runtime from @inithium/db's own DAYS_OF_WEEK (that package depends on
// mongoose) - libs/cms, a Vite-bundled frontend package, only takes `import type` from it.
export const ALL_DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const DIALOG_WIDTH = 680;
export const ALERT_POSITION = 'bottom-right' as const;

export const formatTime12h = (time: string): string => {
  const [hoursRaw, minutes] = time.split(':');
  const hours = Number(hoursRaw);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${minutes} ${period}`;
};

export const formatAgeRange = (min?: number, max?: number): string | undefined => {
  if (min === undefined && max === undefined) return undefined;
  if (max === undefined) return `Ages ${min}+`;
  if (min === undefined) return `Up to age ${max}`;
  return `Ages ${min}–${max}`;
};

// Calendar dates are stored as UTC midnight - format in UTC so they never shift a day.
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const formatCalendarDate = (iso: string): string => dateFormatter.format(new Date(iso));
export const toDateInputValue = (iso?: string): string => (iso ? iso.slice(0, 10) : '');

export const slugify = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Empty -> undefined (leave unset); anything else must be a non-negative number.
export const parseOptionalNumber = (value: string): number | undefined | 'invalid' => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 'invalid';
};
