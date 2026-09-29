import {
  createClassSection,
  createCourse,
  createProgram,
  createSchoolYear,
  getUserRepository,
  listPrograms,
  listStaff,
} from '../index';
import { SEED_PROGRAMS, SEED_SCHOOL_YEAR, SEED_SECTION_CAPACITY } from './class-catalog.seed';
import type { SeedSemesterKey } from './class-catalog.seed';

const STAFF_FETCH_LIMIT = 200;

const toUtcDate = (calendarDate: string): Date => new Date(`${calendarDate}T00:00:00.000Z`);

const normalizeName = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ');

// Staff records never store a name of their own (it's resolved from the linked user), so the
// seed's instructor names are matched against those user names.
const buildStaffIdsByName = async (): Promise<Map<string, string>> => {
  const { items } = await listStaff({ page: 1, pageSize: STAFF_FETCH_LIMIT });
  const entries = await Promise.all(
    items.map(async (staff) => {
      const user = await getUserRepository().findById(staff.userId);
      return user ? ([normalizeName(`${user.firstName} ${user.lastName ?? ''}`), staff.id] as const) : null;
    }),
  );
  return new Map(entries.filter((entry): entry is readonly [string, string] => entry !== null));
};

// Called once at API startup. Like ensureSeededPolicies it only ever runs against an empty
// catalog - once any program exists (seeded or admin-created) the collections are left alone.
export const ensureSeededClassCatalog = async (): Promise<void> => {
  const existing = await listPrograms();
  if (existing.length > 0) return;

  const schoolYear = await createSchoolYear({
    name: SEED_SCHOOL_YEAR.name,
    registrationOpensAt: toUtcDate(SEED_SCHOOL_YEAR.registrationOpensAt),
    isPublished: true,
    semesters: SEED_SCHOOL_YEAR.semesters.map((semester) => ({
      name: semester.name,
      startDate: toUtcDate(semester.startDate),
      endDate: toUtcDate(semester.endDate),
    })),
  });
  // The repository sorts semesters by start date, the same order the seed lists them in.
  const semesterIdsByKey = new Map<SeedSemesterKey, string>(
    SEED_SCHOOL_YEAR.semesters.map((semester, index) => [semester.key, schoolYear.semesters[index]?.id ?? '']),
  );

  const staffIdsByName = await buildStaffIdsByName();
  const unmatchedInstructors = new Set<string>();
  const resolveInstructorIds = (names: string[]): string[] =>
    names.flatMap((name) => {
      const staffId = staffIdsByName.get(normalizeName(name));
      if (!staffId) unmatchedInstructors.add(name);
      return staffId ? [staffId] : [];
    });

  let sectionCount = 0;
  for (const [programIndex, { courses, ...programInput }] of SEED_PROGRAMS.entries()) {
    const program = await createProgram({ ...programInput, order: programIndex, isPublished: true });

    for (const [courseIndex, { sections, isPublished, ...courseInput }] of courses.entries()) {
      const course = await createCourse({
        ...courseInput,
        programId: program.id,
        order: courseIndex,
        isPublished: isPublished ?? true,
      });

      for (const seedSection of sections) {
        await createClassSection({
          courseId: course.id,
          schoolYearId: schoolYear.id,
          semesterIds: seedSection.semesters.map((key) => semesterIdsByKey.get(key) ?? '').filter(Boolean),
          instructorStaffIds: resolveInstructorIds(seedSection.instructors),
          daysOfWeek: [seedSection.day],
          startTime: seedSection.startTime,
          endTime: seedSection.endTime,
          capacity: SEED_SECTION_CAPACITY,
          enrolled: 0,
          isPublished: true,
        });
        sectionCount += 1;
      }
    }
  }

  console.log(`Seeded class catalog: ${SEED_PROGRAMS.length} programs, ${sectionCount} sections`);
  if (unmatchedInstructors.size > 0) {
    console.warn(
      `Class catalog seed: no staff record found for ${[...unmatchedInstructors].join(', ')} - assign these instructors in the CMS.`,
    );
  }
};
