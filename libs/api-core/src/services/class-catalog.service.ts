import {
  DAYS_OF_WEEK,
  getUserRepository,
  listClassSections,
  listCourses,
  listPrograms,
  listSchoolYears,
  listStaff,
  resolveClassPlanOptions,
  resolveSectionSemesters,
} from '@inithium/db';
import type {
  ClassPlanOption,
  ClassSectionEntity,
  CourseEntity,
  ProgramEntity,
  SchoolYearEntity,
  SemesterEntity,
} from '@inithium/db';

const STAFF_FETCH_LIMIT = 200;

export interface InstructorSummary {
  id: string;
  name: string;
  photoUrl?: string;
}

export type InstructorDirectory = Map<string, InstructorSummary>;

// Staff never stores its own name (see staff.route.ts's toStaffDto), so it's resolved from the
// linked user. A studio's staff roster is small enough to load whole per request.
export const loadInstructorDirectory = async (): Promise<InstructorDirectory> => {
  const { items } = await listStaff({ page: 1, pageSize: STAFF_FETCH_LIMIT });
  const summaries = await Promise.all(
    items.map(async (staff): Promise<InstructorSummary> => {
      const user = await getUserRepository().findById(staff.userId);
      return {
        id: staff.id,
        name: [user?.firstName, user?.lastName].filter(Boolean).join(' '),
        ...(staff.photoUrl ? { photoUrl: staff.photoUrl } : {}),
      };
    }),
  );
  return new Map(summaries.map((summary) => [summary.id, summary]));
};

// A staff record deleted after being assigned simply drops out of the list.
const resolveInstructors = (staffIds: string[], directory: InstructorDirectory): InstructorSummary[] =>
  staffIds.flatMap((id) => {
    const instructor = directory.get(id);
    return instructor ? [instructor] : [];
  });

const openingsOf = (section: ClassSectionEntity): number => Math.max(0, section.capacity - section.enrolled);

export const toAdminSectionDto = (section: ClassSectionEntity, directory: InstructorDirectory) => ({
  ...section,
  openings: openingsOf(section),
  instructors: resolveInstructors(section.instructorStaffIds, directory),
});

export interface CatalogSectionDto {
  id: string;
  daysOfWeek: ClassSectionEntity['daysOfWeek'];
  startTime: string;
  endTime: string;
  instructors: InstructorSummary[];
  capacity: number;
  openings: number;
  schoolYear: { id: string; name: string; registrationOpensAt?: Date };
  semesters: SemesterEntity[];
  startDate: Date;
  endDate: Date;
  planOptions: ClassPlanOption[];
}

export type CatalogCourseDto = Omit<CourseEntity, 'isPublished' | 'createdAt' | 'updatedAt' | 'order'> & {
  sections: CatalogSectionDto[];
};

export type PublicProgramDto = Omit<
  ProgramEntity,
  'isPublished' | 'createdAt' | 'updatedAt' | 'order' | 'imageSourceType' | 'imageStorageKey'
>;

export type CatalogProgramDto = PublicProgramDto & {
  courses: CatalogCourseDto[];
};

const toPublicProgram = (program: ProgramEntity): PublicProgramDto => {
  const {
    isPublished: _isPublished,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    order: _order,
    imageSourceType: _imageSourceType,
    imageStorageKey: _imageStorageKey,
    ...publicProgram
  } = program;
  return publicProgram;
};

const dayIndex = (section: CatalogSectionDto): number =>
  Math.min(...section.daysOfWeek.map((day) => DAYS_OF_WEEK.indexOf(day)));

const compareSections = (a: CatalogSectionDto, b: CatalogSectionDto): number =>
  dayIndex(a) - dayIndex(b) || a.startTime.localeCompare(b.startTime);

// null when the section has nothing left to sell - every semester it runs in has ended.
const toCatalogSection = (
  section: ClassSectionEntity,
  course: CourseEntity,
  schoolYear: SchoolYearEntity,
  directory: InstructorDirectory,
  now: Date,
): CatalogSectionDto | null => {
  const semesters = resolveSectionSemesters(section.semesterIds, schoolYear.semesters);
  const firstSemester = semesters[0];
  const lastSemester = semesters[semesters.length - 1];
  const planOptions = resolveClassPlanOptions({
    monthlyPriceCents: course.monthlyPriceCents,
    sectionSemesterIds: section.semesterIds,
    schoolYearSemesters: schoolYear.semesters,
    now,
  });
  if (!firstSemester || !lastSemester || planOptions.length === 0) return null;

  return {
    id: section.id,
    daysOfWeek: section.daysOfWeek,
    startTime: section.startTime,
    endTime: section.endTime,
    instructors: resolveInstructors(section.instructorStaffIds, directory),
    capacity: section.capacity,
    openings: openingsOf(section),
    schoolYear: {
      id: schoolYear.id,
      name: schoolYear.name,
      ...(schoolYear.registrationOpensAt ? { registrationOpensAt: schoolYear.registrationOpensAt } : {}),
    },
    semesters,
    startDate: firstSemester.startDate,
    endDate: lastSemester.endDate,
    planOptions,
  };
};

const toCatalogCourse = (
  course: CourseEntity,
  sections: ClassSectionEntity[],
  schoolYearsById: Map<string, SchoolYearEntity>,
  directory: InstructorDirectory,
  now: Date,
): CatalogCourseDto => {
  const { isPublished: _isPublished, createdAt: _createdAt, updatedAt: _updatedAt, order: _order, ...publicCourse } = course;
  return {
    ...publicCourse,
    sections: sections
      .flatMap((section) => {
        const schoolYear = schoolYearsById.get(section.schoolYearId);
        const dto = schoolYear ? toCatalogSection(section, course, schoolYear, directory, now) : null;
        return dto ? [dto] : [];
      })
      .sort(compareSections),
  };
};

interface PublishedCatalogData {
  programs: ProgramEntity[];
  courses: CourseEntity[];
  sectionsByCourseId: Map<string, ClassSectionEntity[]>;
  schoolYearsById: Map<string, SchoolYearEntity>;
  directory: InstructorDirectory;
}

const loadPublishedCatalogData = async (): Promise<PublishedCatalogData> => {
  const [programs, courses, sections, schoolYears, directory] = await Promise.all([
    listPrograms(),
    listCourses(),
    listClassSections(),
    listSchoolYears(),
    loadInstructorDirectory(),
  ]);

  const sectionsByCourseId = new Map<string, ClassSectionEntity[]>();
  sections
    .filter((section) => section.isPublished)
    .forEach((section) => sectionsByCourseId.set(section.courseId, [...(sectionsByCourseId.get(section.courseId) ?? []), section]));

  return {
    programs: programs.filter((program) => program.isPublished),
    courses: courses.filter((course) => course.isPublished),
    sectionsByCourseId,
    schoolYearsById: new Map(schoolYears.filter((year) => year.isPublished).map((year) => [year.id, year])),
    directory,
  };
};

const toOpenCourses = (program: ProgramEntity, data: PublishedCatalogData, now: Date): CatalogCourseDto[] =>
  data.courses
    .filter((course) => course.programId === program.id)
    .map((course) => toCatalogCourse(course, data.sectionsByCourseId.get(course.id) ?? [], data.schoolYearsById, data.directory, now))
    .filter((course) => course.sections.length > 0);

// The public Classes page: published programs, each with its published courses that still have
// at least one section open for registration. Empty courses and programs are left out.
export const buildPublicCatalog = async (now: Date): Promise<CatalogProgramDto[]> => {
  const data = await loadPublishedCatalogData();

  return data.programs.flatMap((program) => {
    const courses = toOpenCourses(program, data, now);
    return courses.length > 0 ? [{ ...toPublicProgram(program), courses }] : [];
  });
};

// A single program's page. Like the course detail below, a published program with nothing open
// still resolves (with no courses) so a shared link never 404s between terms.
export const buildPublicProgramDetail = async (slug: string, now: Date): Promise<CatalogProgramDto | null> => {
  const data = await loadPublishedCatalogData();
  const program = data.programs.find((candidate) => candidate.slug === slug);
  return program ? { ...toPublicProgram(program), courses: toOpenCourses(program, data, now) } : null;
};

// A single course's detail page. Unlike the listing, a published course with no open sections
// still resolves (so a shared link never 404s mid-year) - it just has an empty sections list.
export const buildPublicCourseDetail = async (
  slug: string,
  now: Date,
): Promise<(CatalogCourseDto & { program: PublicProgramDto }) | null> => {
  const data = await loadPublishedCatalogData();
  const course = data.courses.find((candidate) => candidate.slug === slug);
  const program = course ? data.programs.find((candidate) => candidate.id === course.programId) : undefined;
  if (!course || !program) return null;

  return {
    ...toCatalogCourse(course, data.sectionsByCourseId.get(course.id) ?? [], data.schoolYearsById, data.directory, now),
    program: toPublicProgram(program),
  };
};
