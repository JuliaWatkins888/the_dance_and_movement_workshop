// Frontend helpers for ChildDto.birthDate - kept here (not @inithium/db, which pulls in mongoose)
// so the public profile and the CMS share one set of rules.

const MAX_CHILD_AGE_YEARS = 17;

const toUtcDate = (calendarDate: string): Date => new Date(`${calendarDate}T00:00:00.000Z`);

// "YYYY-MM-DD" for an <input type="date">, from the stored ISO timestamp.
export const toBirthDateInputValue = (iso?: string): string => (iso ? iso.slice(0, 10) : '');

const wholeYearsBetween = (birthDate: Date, on: Date): number => {
  const months = (on.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 + on.getUTCMonth() - birthDate.getUTCMonth();
  return Math.floor((on.getUTCDate() < birthDate.getUTCDate() ? months - 1 : months) / 12);
};

export const childAgeYears = (birthDateIso: string, on: Date = new Date()): number => wholeYearsBetween(new Date(birthDateIso), on);

// Mirrors the API's own check (children.schema.ts): a real date, not in the future, under 18 today.
export const validateChildBirthDate = (calendarDate: string): string | undefined => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(calendarDate)) return 'Enter your child’s date of birth.';
  const date = toUtcDate(calendarDate);
  if (Number.isNaN(date.getTime())) return 'Enter a valid date.';
  if (date > new Date()) return 'Date of birth can’t be in the future.';
  if (wholeYearsBetween(date, new Date()) > MAX_CHILD_AGE_YEARS) return 'Child accounts are for ages 0–17.';
  return undefined;
};

const birthDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

// e.g. "Age 4 · Born Mar 3, 2021"
export const formatChildAge = (birthDateIso: string): string =>
  `Age ${childAgeYears(birthDateIso)} · Born ${birthDateFormatter.format(new Date(birthDateIso))}`;
