// Every display/bucketing/range calculation in this plugin goes through the configured business
// timezone (TimeSettingsDto.timezone) - entries themselves always cross the wire as UTC ISO
// instants. No date library: Node 20+ and every evergreen browser ship full ICU, so
// Intl.DateTimeFormat already covers every zone-aware need this plugin has (confirmed - there is
// no date-fns/luxon/dayjs/moment anywhere in this codebase).

const formatPartsInZone = (utcMillis: number, timeZone: string, options: Intl.DateTimeFormatOptions): Record<string, string> => {
  const parts: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-US', { timeZone, ...options }).formatToParts(new Date(utcMillis))) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return parts;
};

const NUMERIC_PARTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
};

// "YYYY-MM-DD" as it reads on a clock in `timeZone` - the calendar-day bucket an entry belongs to
// for the review grid/history list, independent of what UTC day its instant technically falls on.
export const zonedDateKey = (isoInstant: string, timeZone: string): string => {
  const parts = formatPartsInZone(new Date(isoInstant).getTime(), timeZone, NUMERIC_PARTS);
  return `${parts['year']}-${parts['month']}-${parts['day']}`;
};

// "HH:mm" (24-hour) as it reads on a clock in `timeZone` - feeds TimePicker's own "HH:mm"
// contract, used to prefill the entry edit dialog's start/end pickers from an entry's stored UTC
// instant. Paired with zonedDateKey (above) for the date half.
export const zonedTimeOnlyValue = (isoInstant: string, timeZone: string): string => {
  const parts = formatPartsInZone(new Date(isoInstant).getTime(), timeZone, NUMERIC_PARTS);
  const hour = parts['hour'] === '24' ? '00' : parts['hour'];
  return `${hour}:${parts['minute']}`;
};

// Adds (or subtracts) whole days to a "YYYY-MM-DD" key - used by the entry edit dialog to roll an
// end date forward when the chosen end time is numerically before the start time (an overnight
// shift), without needing a second, independent end-date picker.
export const addDaysToDateKey = (dateKey: string, days: number): string => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

export const formatClockTime = (isoInstant: string, timeZone: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(isoInstant));

export const formatZonedDate = (isoInstant: string, timeZone: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(isoInstant));

const ORDINAL_SUFFIX_BY_CATEGORY: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' };
const ordinalPluralRules = new Intl.PluralRules('en-US', { type: 'ordinal' });
const toOrdinal = (day: number): string => `${day}${ORDINAL_SUFFIX_BY_CATEGORY[ordinalPluralRules.select(day)] ?? 'th'}`;

// "September 3rd" - dateKey is a plain "YYYY-MM-DD" calendar date (already the zoned day a
// calendar cell represents, see zonedDateKey/getMonthGridDays), so no further zone conversion is
// needed, just formatting. Used by the mobile calendar list, where a bare day-of-month number
// read badly out of context on its own.
export const formatOrdinalDate = (dateKey: string): string => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const monthLabel = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
  return `${monthLabel} ${toOrdinal(day)}`;
};

export const formatDurationMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${String(remaining).padStart(2, '0')}m`;
};

// Converts a wall-clock date/time as it reads on a clock in `timeZone` into the UTC instant it
// corresponds to - the reverse of zonedDateTimeLocalValue above, and the same round-trip trick
// this plugin's backend uses (api-core/routes/time/timeZoneMath.ts's zonedWallTimeToUtc).
// Duplicated here rather than shared, since this is a different runtime (browser vs. Node) with
// no code-sharing path between them in this plugin's layout.
export const zonedWallTimeToUtc = (wallTime: string, timeZone: string): Date => {
  const [datePart, timePart = '00:00:00'] = wallTime.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second = 0] = timePart.split(':').map(Number);
  const desiredMillis = Date.UTC(year, month - 1, day, hour, minute, second);

  let guessMillis = desiredMillis;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = formatPartsInZone(guessMillis, timeZone, NUMERIC_PARTS);
    const observedHour = parts['hour'] === '24' ? '00' : parts['hour'];
    const observedMillis = Date.UTC(
      Number(parts['year']),
      Number(parts['month']) - 1,
      Number(parts['day']),
      Number(observedHour),
      Number(parts['minute']),
      Number(parts['second']),
    );
    const driftMillis = desiredMillis - observedMillis;
    if (driftMillis === 0) break;
    guessMillis += driftMillis;
  }
  return new Date(guessMillis);
};

// A "fake UTC" Date used purely as calendar-arithmetic scratch space (add days/months, read
// day-of-week) - its year/month/day fields represent the zoned calendar date, but it is never
// treated as a real instant. toDateKey/toUtcInstant below are the only two ways it's converted
// back into something real.
const zonedTodayAsFakeUtc = (timeZone: string): Date => {
  const [year, month, day] = zonedDateKey(new Date().toISOString(), timeZone).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const toDateKey = (fakeUtc: Date): string => fakeUtc.toISOString().slice(0, 10);
const toUtcInstant = (dateKey: string, timeZone: string): string => zonedWallTimeToUtc(`${dateKey}T00:00:00`, timeZone).toISOString();

export interface UtcRange {
  from: string;
  to: string;
}

export const getTodayRangeUtc = (timeZone: string): UtcRange => {
  const today = zonedTodayAsFakeUtc(timeZone);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return { from: toUtcInstant(toDateKey(today), timeZone), to: toUtcInstant(toDateKey(tomorrow), timeZone) };
};

export const getWeekRangeUtc = (timeZone: string): UtcRange => {
  const today = zonedTodayAsFakeUtc(timeZone);
  const weekStart = new Date(today);
  weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  return { from: toUtcInstant(toDateKey(weekStart), timeZone), to: toUtcInstant(toDateKey(weekEnd), timeZone) };
};

// monthAnchor is a fake-UTC Date (see above) representing any day in the target month - defaults
// to the current zoned month so ReviewPanel's prev/next controls can pass an already-shifted one.
export const getMonthRangeUtc = (timeZone: string, monthAnchor?: Date): UtcRange => {
  const anchor = monthAnchor ?? zonedTodayAsFakeUtc(timeZone);
  const monthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  return { from: toUtcInstant(toDateKey(monthStart), timeZone), to: toUtcInstant(toDateKey(monthEnd), timeZone) };
};

export const getYearRangeUtc = (timeZone: string): UtcRange => {
  const today = zonedTodayAsFakeUtc(timeZone);
  const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const yearEnd = new Date(Date.UTC(today.getUTCFullYear() + 1, 0, 1));
  return { from: toUtcInstant(toDateKey(yearStart), timeZone), to: toUtcInstant(toDateKey(yearEnd), timeZone) };
};

export const getCurrentZonedMonthAnchor = (timeZone: string): Date => zonedTodayAsFakeUtc(timeZone);

export const shiftMonthAnchor = (monthAnchor: Date, deltaMonths: number): Date =>
  new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() + deltaMonths, 1));

export const formatMonthLabel = (monthAnchor: Date): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(monthAnchor);

export interface MonthGridDay {
  dateKey: string;
  dayOfMonth: number;
}

// The days of the month itself, in order - the grid component positions day 1 at
// `monthStart.getUTCDay()` leading empty cells rather than this helper returning adjacent-month
// filler days.
export const getMonthGridDays = (monthAnchor: Date): MonthGridDay[] => {
  const year = monthAnchor.getUTCFullYear();
  const month = monthAnchor.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(Date.UTC(year, month, index + 1));
    return { dateKey: toDateKey(date), dayOfMonth: index + 1 };
  });
};

export const getMonthLeadingBlankCount = (monthAnchor: Date): number =>
  new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth(), 1)).getUTCDay();
