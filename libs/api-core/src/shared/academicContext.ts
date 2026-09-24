import { getAcademicYearById, listSemestersByAcademicYearId } from '@inithium/db';
import type { AcademicYearEntity, SemesterEntity, SemesterTerm } from '@inithium/db';

export interface AcademicYearContext {
  academicYear: AcademicYearEntity | null;
  // Every semester of the year (published or not), ordered by start date.
  semesters: SemesterEntity[];
}

export type AcademicYearContextLoader = (academicYearId: string) => Promise<AcademicYearContext>;

// One loader per request: Course/Class/Workshop DTO builders all resolve their academic year and its
// semesters, and a catalog listing typically has dozens of rows sharing the same one or two years -
// memoizing the in-flight promise collapses that to a single lookup per year instead of one per row.
export const createAcademicYearContextLoader = (): AcademicYearContextLoader => {
  const cache = new Map<string, Promise<AcademicYearContext>>();
  return (academicYearId) => {
    const cached = cache.get(academicYearId);
    if (cached) return cached;
    const pending = Promise.all([getAcademicYearById(academicYearId), listSemestersByAcademicYearId(academicYearId)]).then(
      ([academicYear, semesters]) => ({ academicYear, semesters }),
    );
    cache.set(academicYearId, pending);
    return pending;
  };
};

export interface SemesterSummary {
  id: string;
  name: string;
  term: SemesterTerm;
  startDate: Date;
  endDate: Date;
  registrationOpensAt?: Date;
  isPublished: boolean;
}

export const toSemesterSummary = (semester: SemesterEntity): SemesterSummary => ({
  id: semester.id,
  name: semester.name,
  term: semester.term,
  startDate: semester.startDate,
  endDate: semester.endDate,
  registrationOpensAt: semester.registrationOpensAt,
  isPublished: semester.isPublished,
});

// Preserves the input order, so passing a year's start-date-ordered semesters yields the scoped
// subset in that same order.
export const pickSemesters = (yearSemesters: SemesterEntity[], semesterIds: string[]): SemesterEntity[] =>
  yearSemesters.filter((semester) => semesterIds.includes(semester.id));

// True when a Course/Class runs in every semester its year has - the condition for offering the
// pay-for-the-year price tier and for calling a Course "full year".
export const coversWholeYear = (yearSemesters: SemesterEntity[], semesterIds: string[]): boolean =>
  yearSemesters.length > 0 && yearSemesters.every((semester) => semesterIds.includes(semester.id));

// A year has no dates of its own (see academic-year.contract.ts) - it spans its semesters.
export const getAcademicYearSpan = (semesters: SemesterEntity[]): { startDate?: Date; endDate?: Date } => {
  if (semesters.length === 0) return {};
  return {
    startDate: new Date(Math.min(...semesters.map((semester) => semester.startDate.getTime()))),
    endDate: new Date(Math.max(...semesters.map((semester) => semester.endDate.getTime()))),
  };
};
