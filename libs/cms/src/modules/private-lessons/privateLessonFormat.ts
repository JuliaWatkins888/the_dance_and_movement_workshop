import type { PrivateLessonOccurrenceDto, PrivateLessonScheduleDto } from '@inithium/api-client';
import { formatTime12h } from '../classes/classAdmin.shared';

const DAY_MS = 86_400_000;

// Calendar dates are "YYYY-MM-DD"; formatting in UTC keeps them from shifting a day.
const longDayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const shortDayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const fullDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const toUtc = (dateKey: string): Date => new Date(`${dateKey}T00:00:00.000Z`);

export const formatLongDay = (dateKey: string): string => longDayFormatter.format(toUtc(dateKey));
export const formatShortDay = (dateKey: string): string => shortDayFormatter.format(toUtc(dateKey));
export const formatFullDate = (dateKey: string): string => fullDateFormatter.format(toUtc(dateKey));

export const addDays = (dateKey: string, days: number): string => new Date(toUtc(dateKey).getTime() + days * DAY_MS).toISOString().slice(0, 10);

// The Monday of the week dateKey falls in.
export const weekStartOf = (dateKey: string): string => addDays(dateKey, -((toUtc(dateKey).getUTCDay() + 6) % 7));

export const todayKey = (): string => {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
};

export const formatTimeRange = (startTime: string, endTime: string): string => `${formatTime12h(startTime)}–${formatTime12h(endTime)}`;

export const scheduleLabel = (schedule: PrivateLessonScheduleDto): string =>
  schedule.kind === 'weekly'
    ? [
        `${schedule.weekday}s ${formatTimeRange(schedule.startTime, schedule.endTime)}`,
        `from ${formatFullDate(schedule.startDate)}`,
        schedule.endDate ? `until ${formatFullDate(schedule.endDate)}` : undefined,
      ]
        .filter(Boolean)
        .join(' · ')
    : `${formatFullDate(schedule.date)} ${formatTimeRange(schedule.startTime, schedule.endTime)} (one time)`;

export const occurrenceLabel = (occurrence: PrivateLessonOccurrenceDto): string =>
  [
    `${formatShortDay(occurrence.date)} ${formatTimeRange(occurrence.startTime, occurrence.endTime)}`,
    occurrence.isMoved ? `moved from ${formatShortDay(occurrence.scheduledDate)}` : undefined,
    occurrence.status === 'cancelled' ? 'cancelled' : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
