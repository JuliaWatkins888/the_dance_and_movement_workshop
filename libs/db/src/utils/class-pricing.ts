import type { SemesterEntity } from '../contracts/school-year.contract';

export const SEMESTER_DISCOUNT_PERCENT = 5;
export const YEAR_DISCOUNT_PERCENT = 10;

const DAY_MS = 86_400_000;

export type ClassPlanKind = 'monthly' | 'semester' | 'year';

export interface ClassPlanOption {
  kind: ClassPlanKind;
  // Monthly: charged each month. Semester/year: the single up-front payment.
  amountCents: number;
  // Semester/year only.
  semesterId?: string;
  semesterName?: string;
  startDate?: Date;
  endDate?: Date;
  months?: number;
  fullPriceCents?: number;
  discountPercent?: number;
}

export interface ClassPlanInput {
  monthlyPriceCents: number;
  sectionSemesterIds: string[];
  schoolYearSemesters: SemesterEntity[];
  now: Date;
}

// Every calendar month a date range touches counts in full - Sep 14 to Dec 20 is 4 months. The
// studio never prorates.
export const countMonthsTouched = (startDate: Date, endDate: Date): number =>
  (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + endDate.getUTCMonth() - startDate.getUTCMonth() + 1;

export const applyDiscount = (amountCents: number, discountPercent: number): number =>
  Math.round((amountCents * (100 - discountPercent)) / 100);

// endDate is stored as midnight UTC of the last class day, so the semester is still running
// until that whole day has passed.
const hasEnded = (endDate: Date, now: Date): boolean => endDate.getTime() + DAY_MS <= now.getTime();

const bulkOption = (
  kind: 'semester' | 'year',
  monthlyPriceCents: number,
  startDate: Date,
  endDate: Date,
  discountPercent: number,
  semester?: SemesterEntity,
): ClassPlanOption => {
  const months = countMonthsTouched(startDate, endDate);
  const fullPriceCents = monthlyPriceCents * months;
  return {
    kind,
    amountCents: applyDiscount(fullPriceCents, discountPercent),
    ...(semester ? { semesterId: semester.id, semesterName: semester.name } : {}),
    startDate,
    endDate,
    months,
    fullPriceCents,
    discountPercent,
  };
};

export const sortSemesters = (semesters: SemesterEntity[]): SemesterEntity[] =>
  [...semesters].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

export const resolveSectionSemesters = (sectionSemesterIds: string[], schoolYearSemesters: SemesterEntity[]): SemesterEntity[] =>
  sortSemesters(schoolYearSemesters.filter((semester) => sectionSemesterIds.includes(semester.id)));

// The plans a family can still buy for one section. Joining late never earns a discount - a
// running semester is still sold at its full semester price - so a plan only drops off once its
// period has ended. The year plan exists only for a section that runs every semester of its year.
export const resolveClassPlanOptions = ({
  monthlyPriceCents,
  sectionSemesterIds,
  schoolYearSemesters,
  now,
}: ClassPlanInput): ClassPlanOption[] => {
  const sectionSemesters = resolveSectionSemesters(sectionSemesterIds, schoolYearSemesters);
  const openSemesters = sectionSemesters.filter((semester) => !hasEnded(semester.endDate, now));
  if (openSemesters.length === 0) return [];

  const semesterOptions = openSemesters.map((semester) =>
    bulkOption('semester', monthlyPriceCents, semester.startDate, semester.endDate, SEMESTER_DISCOUNT_PERCENT, semester),
  );

  const yearSemesters = sortSemesters(schoolYearSemesters);
  const firstSemester = yearSemesters[0];
  const lastSemester = yearSemesters[yearSemesters.length - 1];
  const runsFullYear =
    firstSemester !== undefined && yearSemesters.every((semester) => sectionSemesterIds.includes(semester.id));
  const yearOptions =
    runsFullYear && lastSemester
      ? [bulkOption('year', monthlyPriceCents, firstSemester.startDate, lastSemester.endDate, YEAR_DISCOUNT_PERCENT)]
      : [];

  return [{ kind: 'monthly', amountCents: monthlyPriceCents }, ...semesterOptions, ...yearOptions];
};

export interface LedgerTuitionTermsInput {
  firstMonthCents: number;
  monthlyAmountCents: number;
  discountCents: number;
  discountMonths?: number;
}

export interface LedgerTuitionMonth {
  billingMonth: string; // yyyy-mm
  monthStart: Date;
  amountCents: number;
}

export interface LedgerTuitionInput {
  terms: LedgerTuitionTermsInput;
  // The registration's coverage: startsAt falls in the first charged month, endsAt is exclusive.
  startsAt: Date;
  endsAt: Date;
  withdrawnAt?: Date;
  now: Date;
}

const utcMonthStart = (date: Date, offsetMonths = 0): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offsetMonths, 1));

export const toBillingMonth = (date: Date): string => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const monthAmount = (terms: LedgerTuitionTermsInput, index: number): number => {
  if (index === 0) return terms.firstMonthCents;
  const discounted = terms.discountMonths === undefined || index <= terms.discountMonths;
  return Math.max(0, terms.monthlyAmountCents - (discounted ? terms.discountCents : 0));
};

// Every month a pay-in-person monthly registration owes as of `now`, matching the card plan: the
// first month is charged at registration (even when it starts later), and each following month on
// its 1st, through the section's last month. A withdrawal stops the months after it; a month whose
// 1st had already come stays owed.
export const ledgerTuitionMonths = ({ terms, startsAt, endsAt, withdrawnAt, now }: LedgerTuitionInput): LedgerTuitionMonth[] => {
  const cutoff = withdrawnAt && withdrawnAt < now ? withdrawnAt : now;
  const months: LedgerTuitionMonth[] = [];
  for (let index = 0; ; index += 1) {
    const monthStart = utcMonthStart(startsAt, index);
    if (index > 0 && (monthStart >= endsAt || monthStart > cutoff)) break;
    months.push({ billingMonth: toBillingMonth(monthStart), monthStart, amountCents: monthAmount(terms, index) });
  }
  return months;
};

// When a withdrawn pay-in-person registration's last owed month runs out.
export const ledgerTuitionAccessEndsAt = (startsAt: Date, endsAt: Date, withdrawnAt: Date): Date => {
  const lastMonth = withdrawnAt > startsAt ? withdrawnAt : startsAt;
  const nextMonth = utcMonthStart(lastMonth, 1);
  return nextMonth < endsAt ? nextMonth : endsAt;
};
