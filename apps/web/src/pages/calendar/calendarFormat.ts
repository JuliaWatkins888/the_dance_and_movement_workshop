import type { CalendarItemCategory, CalendarItemDto } from '@inithium/api-client';
import { formatTime12h } from '../classes/classFormat';

export interface CalendarCategoryConfig {
  readonly category: CalendarItemCategory;
  readonly label: string;
  // Semantic token the category's items are painted with.
  readonly color: string;
}

export const CALENDAR_CATEGORIES: readonly CalendarCategoryConfig[] = [
  { category: 'classes', label: 'Classes', color: 'primary' },
  { category: 'workshops', label: 'Workshops', color: 'secondary' },
  { category: 'events', label: 'Events', color: 'accent' },
  { category: 'closures', label: 'Holidays & Closures', color: 'tertiary' },
  { category: 'other', label: 'Other', color: 'quaternary' },
];

export const colorOfCategory = (category: CalendarItemCategory): string =>
  CALENDAR_CATEGORIES.find((config) => config.category === category)?.color ?? 'primary';

const pad = (value: number): string => String(value).padStart(2, '0');

// Local calendar date of a Date the calendar reports (its range bounds are local midnights).
export const toLocalDateKey = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Items carry wall-clock "YYYY-MM-DD[THH:mm]" strings - built as UTC so formatting never shifts them.
const toUtcDate = (dateKey: string): Date => new Date(`${dateKey}T00:00:00.000Z`);

const addDays = (dateKey: string, days: number): string => {
  const date = toUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const longDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const formatLongDate = (dateKey: string): string => longDateFormatter.format(toUtcDate(dateKey));

const splitStamp = (stamp: string): { date: string; time?: string } => {
  const [date, time] = stamp.split('T');
  return time ? { date, time } : { date };
};

// "Monday, October 12, 2026", "Monday, October 12, 2026 · 6:00 PM – 8:00 PM", or a span across dates.
export const formatWhen = (item: Pick<CalendarItemDto, 'start' | 'end' | 'allDay'>): string => {
  const start = splitStamp(item.start);
  if (item.allDay) {
    const lastDate = item.end ? addDays(item.end, -1) : start.date;
    return lastDate === start.date ? formatLongDate(start.date) : `${formatLongDate(start.date)} – ${formatLongDate(lastDate)}`;
  }
  const end = item.end ? splitStamp(item.end) : undefined;
  const startLabel = start.time ? formatTime12h(start.time) : '';
  if (!end?.time) return `${formatLongDate(start.date)} · ${startLabel}`;
  if (end.date === start.date) return `${formatLongDate(start.date)} · ${startLabel} – ${formatTime12h(end.time)}`;
  return `${formatLongDate(start.date)}, ${startLabel} – ${formatLongDate(end.date)}, ${formatTime12h(end.time)}`;
};

// Holidays say whether the studio is open, since that's what families look them up for.
export const displayTitle = (item: CalendarItemDto): string => {
  if (item.kind !== 'holiday') return item.title;
  return item.isStudioClosed ? `${item.title} · Studio Closed` : `${item.title} · Studio Open`;
};
