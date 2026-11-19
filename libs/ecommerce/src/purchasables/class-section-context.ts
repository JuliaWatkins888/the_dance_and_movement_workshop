import {
  getClassSectionRepository,
  getCourseRepository,
  getProgramRepository,
  getSchoolYearRepository,
  getUserRepository,
  resolveSectionSemesters,
} from '@inithium/db';
import type {
  AttendeeRef,
  ClassSectionEntity,
  CourseEntity,
  LineOptions,
  ProgramEntity,
  SchoolYearEntity,
  SemesterEntity,
} from '@inithium/db';

// Shared by the class (term) and drop-in purchasables, which both sell seats in a class section.

// { attendee: 'self' } or { attendee: 'child', childId } from a cart line's options.
export const parseAttendee = (options: LineOptions): AttendeeRef | null =>
  options['attendee'] === 'self'
    ? { type: 'self' }
    : options['attendee'] === 'child' && options['childId']
      ? { type: 'child', childId: options['childId'] }
      : null;

export const sameAttendee = (a: AttendeeRef, b: AttendeeRef): boolean =>
  a.type === 'self' ? b.type === 'self' : b.type === 'child' && a.childId === b.childId;

export interface SectionContext {
  section: ClassSectionEntity;
  course: CourseEntity;
  program: ProgramEntity;
  schoolYear: SchoolYearEntity;
  semesters: SemesterEntity[];
}

// Everything published that a line depends on, or null when any of it is gone or hidden.
export const loadSectionContext = async (sectionId: string): Promise<SectionContext | null> => {
  const section = await getClassSectionRepository().findById(sectionId);
  if (!section?.isPublished) return null;
  const [course, schoolYear] = await Promise.all([
    getCourseRepository().findById(section.courseId),
    getSchoolYearRepository().findById(section.schoolYearId),
  ]);
  if (!course?.isPublished || !schoolYear?.isPublished) return null;
  const program = await getProgramRepository().findById(course.programId);
  if (!program?.isPublished) return null;
  return { section, course, program, schoolYear, semesters: resolveSectionSemesters(section.semesterIds, schoolYear.semesters) };
};

const formatTime = (time: string): string => {
  const [hoursRaw, minutes] = time.split(':');
  const hours = Number(hoursRaw);
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
};

export const sectionLabel = (section: ClassSectionEntity): string =>
  `${section.daysOfWeek.map((day) => day.slice(0, 3)).join(' & ')} ${formatTime(section.startTime)}`;

export const loadUserName = async (userId: string): Promise<string> => {
  const user = await getUserRepository().findById(userId);
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ');
};
