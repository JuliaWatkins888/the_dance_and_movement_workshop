export interface FederalHoliday {
  key: string;
  name: string;
  // "YYYY-MM-DD" of the holiday's actual date - never the shifted weekday "observed" date.
  date: string;
}

type HolidayRule =
  | { key: string; name: string; kind: 'fixed'; month: number; day: number }
  // nth = -1 means the last such weekday of the month. weekday: 0 = Sunday ... 6 = Saturday.
  | { key: string; name: string; kind: 'nthWeekday'; month: number; weekday: number; nth: number };

// The 11 permanent holidays of 5 U.S.C. 6103 (Inauguration Day only applies around Washington DC).
// Months are 1-based.
const FEDERAL_HOLIDAY_RULES: readonly HolidayRule[] = [
  { key: 'new-years-day', name: "New Year's Day", kind: 'fixed', month: 1, day: 1 },
  { key: 'mlk-day', name: 'Martin Luther King Jr. Day', kind: 'nthWeekday', month: 1, weekday: 1, nth: 3 },
  { key: 'presidents-day', name: "Presidents' Day", kind: 'nthWeekday', month: 2, weekday: 1, nth: 3 },
  { key: 'memorial-day', name: 'Memorial Day', kind: 'nthWeekday', month: 5, weekday: 1, nth: -1 },
  { key: 'juneteenth', name: 'Juneteenth', kind: 'fixed', month: 6, day: 19 },
  { key: 'independence-day', name: 'Independence Day', kind: 'fixed', month: 7, day: 4 },
  { key: 'labor-day', name: 'Labor Day', kind: 'nthWeekday', month: 9, weekday: 1, nth: 1 },
  { key: 'columbus-day', name: 'Columbus Day', kind: 'nthWeekday', month: 10, weekday: 1, nth: 2 },
  { key: 'veterans-day', name: 'Veterans Day', kind: 'fixed', month: 11, day: 11 },
  { key: 'thanksgiving', name: 'Thanksgiving Day', kind: 'nthWeekday', month: 11, weekday: 4, nth: 4 },
  { key: 'christmas-day', name: 'Christmas Day', kind: 'fixed', month: 12, day: 25 },
];

const pad = (value: number): string => String(value).padStart(2, '0');

const toDateKey = (year: number, month: number, day: number): string => `${year}-${pad(month)}-${pad(day)}`;

const nthWeekdayOfMonth = (year: number, month: number, weekday: number, nth: number): number => {
  if (nth > 0) {
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return 1 + ((weekday - firstWeekday + 7) % 7) + (nth - 1) * 7;
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastWeekday = new Date(Date.UTC(year, month - 1, lastDay)).getUTCDay();
  return lastDay - ((lastWeekday - weekday + 7) % 7);
};

const resolveRule = (rule: HolidayRule, year: number): FederalHoliday => ({
  key: rule.key,
  name: rule.name,
  date:
    rule.kind === 'fixed'
      ? toDateKey(year, rule.month, rule.day)
      : toDateKey(year, rule.month, nthWeekdayOfMonth(year, rule.month, rule.weekday, rule.nth)),
});

export const listFederalHolidays = (year: number): FederalHoliday[] => FEDERAL_HOLIDAY_RULES.map((rule) => resolveRule(rule, year));

// Holidays with fromKey <= date <= toKey ("YYYY-MM-DD", inclusive), in date order.
export const listFederalHolidaysBetween = (fromKey: string, toKey: string): FederalHoliday[] => {
  const firstYear = Number(fromKey.slice(0, 4));
  const lastYear = Number(toKey.slice(0, 4));
  return Array.from({ length: lastYear - firstYear + 1 }, (_, offset) => listFederalHolidays(firstYear + offset))
    .flat()
    .filter((holiday) => holiday.date >= fromKey && holiday.date <= toKey)
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const findFederalHoliday = (dateKey: string): FederalHoliday | undefined =>
  listFederalHolidays(Number(dateKey.slice(0, 4))).find((holiday) => holiday.date === dateKey);
