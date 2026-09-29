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
