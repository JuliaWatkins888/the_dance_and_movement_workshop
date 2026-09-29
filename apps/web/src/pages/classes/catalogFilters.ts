import type { CatalogCourseDto, CatalogProgramDto, CatalogSectionDto } from '@inithium/api-client';
import type { DayOfWeek } from '@inithium/db';
import { WEEKDAY_ORDER, courseMatchesAge, formatDateRange, sectionMatchesDay } from './classFormat';

export interface CatalogFilters {
  readonly search: string;
  readonly age?: number;
  readonly day?: DayOfWeek;
}

// One bookable time slot, paired with the course it belongs to - the unit a program page lists.
export interface SectionListing {
  readonly course: CatalogCourseDto;
  readonly section: CatalogSectionDto;
}

const matchesSearch = (course: CatalogCourseDto, section: CatalogSectionDto, query: string): boolean => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const haystack = [course.name, ...course.styles, ...section.instructors.map((instructor) => instructor.name)];
  return haystack.join(' ').toLowerCase().includes(trimmed);
};

// Keeps the program's course order, then each course's own day/time order.
export const filterSectionListings = (program: CatalogProgramDto, filters: CatalogFilters): SectionListing[] =>
  program.courses.flatMap((course) => {
    if (filters.age !== undefined && !courseMatchesAge(course, filters.age)) return [];
    return course.sections
      .filter((section) => (filters.day ? sectionMatchesDay(section, filters.day) : true))
      .filter((section) => matchesSearch(course, section, filters.search))
      .map((section) => ({ course, section }));
  });

export const collectDays = (programs: CatalogProgramDto[]): DayOfWeek[] => {
  const days = new Set(programs.flatMap((program) => program.courses.flatMap((course) => course.sections.flatMap((section) => section.daysOfWeek))));
  return WEEKDAY_ORDER.filter((weekday) => days.has(weekday));
};

export interface SchoolYearSummary {
  readonly name: string;
  readonly semesters: string[];
}

// Headline dates for the (typically single) school year currently on offer.
export const summarizeSchoolYear = (programs: CatalogProgramDto[]): SchoolYearSummary | undefined => {
  const sections = programs.flatMap((program) => program.courses.flatMap((course) => course.sections));
  const schoolYear = sections[0]?.schoolYear;
  if (!schoolYear) return undefined;
  const semesters = sections.filter((section) => section.schoolYear.id === schoolYear.id).flatMap((section) => section.semesters);
  const uniqueSemesters = [...new Map(semesters.map((semester) => [semester.id, semester])).values()].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  return {
    name: schoolYear.name,
    semesters: uniqueSemesters.map((semester) => `${semester.name}: ${formatDateRange(semester.startDate, semester.endDate)}`),
  };
};
