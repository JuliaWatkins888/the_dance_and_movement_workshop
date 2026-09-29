import type { DayOfWeek } from '../contracts/class-section.contract';
import type { CourseEntity } from '../contracts/course.contract';
import type { SemesterEntity } from '../contracts/school-year.contract';
import type { ClassPlanKind } from './class-pricing';
import { sortSemesters } from './class-pricing';

const DAY_MS = 86_400_000;
// Date.getUTCDay() order.
const UTC_WEEKDAYS: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Users are never asked their age; the studio treats every account holder as an adult, so
// enrolling yourself is limited to adult courses.
export const SELF_ENROLL_MIN_AGE_YEARS = 18;

// Whole months lived as of `on` (a birthday not yet reached this month doesn't count).
export const ageInMonths = (birthDate: Date, on: Date): number => {
  const months = (on.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 + on.getUTCMonth() - birthDate.getUTCMonth();
  return on.getUTCDate() < birthDate.getUTCDate() ? months - 1 : months;
};

export const ageInYears = (birthDate: Date, on: Date): number => Math.floor(ageInMonths(birthDate, on) / 12);

// The minimum is exact (2.5 = 2 years 6 months). The maximum covers that whole year of age - a
// "4–6" course admits a child until their 7th birthday, which is what keeps back-to-back catalog
// ranges ("4–6", "7–10") free of gaps.
export const isAgeEligible = (birthDate: Date, on: Date, course: Pick<CourseEntity, 'minAgeYears' | 'maxAgeYears'>): boolean => {
  const months = ageInMonths(birthDate, on);
  if (course.minAgeYears !== undefined && months < Math.ceil(course.minAgeYears * 12)) return false;
  if (course.maxAgeYears !== undefined && months >= Math.floor((course.maxAgeYears + 1) * 12)) return false;
  return true;
};

export const isSelfEnrollable = (course: Pick<CourseEntity, 'minAgeYears'>): boolean =>
  course.minAgeYears !== undefined && course.minAgeYears >= SELF_ENROLL_MIN_AGE_YEARS;

const startOfUtcDay = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const startOfUtcMonth = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const addUtcMonths = (date: Date, months: number): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));

// Renewals run at noon UTC rather than midnight so "the 1st" is still the 1st in every timezone
// from Hawaii to central Europe - both when the card is charged and when the date is displayed.
const RENEWAL_HOUR_UTC = 12;
const atRenewalHour = (monthStart: Date): Date => new Date(monthStart.getTime() + RENEWAL_HOUR_UTC * 3_600_000);

// The first calendar day on or after `from` that the section meets (a scheduled weekday inside
// one of its semesters), or undefined when it never meets again.
export const nextClassDay = (daysOfWeek: DayOfWeek[], semesters: SemesterEntity[], from: Date): Date | undefined => {
  const start = startOfUtcDay(from);
  for (const semester of sortSemesters(semesters)) {
    if (semester.endDate < start) continue;
    let day = semester.startDate > start ? startOfUtcDay(semester.startDate) : start;
    while (day <= semester.endDate) {
      if (daysOfWeek.includes(UTC_WEEKDAYS[day.getUTCDay()] as DayOfWeek)) return day;
      day = new Date(day.getTime() + DAY_MS);
    }
  }
  return undefined;
};

export interface MonthlySchedule {
  // The month paid at checkout.
  firstMonthStart: Date;
  // Noon UTC on the 1st of the following month - the first automatic renewal.
  nextBillingAt: Date;
  // The day after the last class; no renewal is charged on or after it.
  endsAt: Date;
}

// A monthly plan's first charged month is the month of the next class day - the current month if
// the section still meets in it, otherwise the next month it does. Renewals follow on the 1st.
export const resolveMonthlySchedule = (daysOfWeek: DayOfWeek[], semesters: SemesterEntity[], now: Date): MonthlySchedule | null => {
  const firstClass = nextClassDay(daysOfWeek, semesters, now);
  const lastSemester = sortSemesters(semesters)[semesters.length - 1];
  if (!firstClass || !lastSemester) return null;
  const firstMonthStart = startOfUtcMonth(firstClass);
  return {
    firstMonthStart,
    nextBillingAt: atRenewalHour(addUtcMonths(firstMonthStart, 1)),
    endsAt: new Date(startOfUtcDay(lastSemester.endDate).getTime() + DAY_MS),
  };
};

export interface PlanCoverage {
  startsAt: Date;
  // Exclusive - the day after the last class the plan pays for.
  endsAt: Date;
}

// The span of classes a plan entitles the attendee to - used to stop the same dancer being
// registered twice for overlapping periods of one section.
export const resolvePlanCoverage = (
  plan: ClassPlanKind,
  semesterId: string | undefined,
  daysOfWeek: DayOfWeek[],
  sectionSemesters: SemesterEntity[],
  now: Date,
): PlanCoverage | null => {
  const sorted = sortSemesters(sectionSemesters);
  if (plan === 'monthly') {
    const schedule = resolveMonthlySchedule(daysOfWeek, sorted, now);
    return schedule ? { startsAt: schedule.firstMonthStart, endsAt: schedule.endsAt } : null;
  }
  const covered = plan === 'semester' ? sorted.filter((semester) => semester.id === semesterId) : sorted;
  const first = covered[0];
  const last = covered[covered.length - 1];
  if (!first || !last) return null;
  return { startsAt: startOfUtcDay(first.startDate), endsAt: new Date(startOfUtcDay(last.endDate).getTime() + DAY_MS) };
};

export const coveragesOverlap = (a: PlanCoverage, b: PlanCoverage): boolean => a.startsAt < b.endsAt && b.startsAt < a.endsAt;
