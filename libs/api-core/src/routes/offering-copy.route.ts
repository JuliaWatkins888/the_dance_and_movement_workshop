import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { createClass, createCourse, getCourseById, getStaffById, listClassesByCourseIds, listCoursesByAcademicYearId } from '@inithium/db';
import type { ClassEntity, CourseEntity, SemesterEntity } from '@inithium/db';
import { copyOfferingsSchema } from '../schemas/offering-copy.schema';
import { coversWholeYear, createAcademicYearContextLoader, pickSemesters, toSemesterSummary } from '../shared/academicContext';
import type { AcademicYearContext } from '../shared/academicContext';
import { duplicateCourseImage } from '../shared/courseUploads';
import { resolveInstructorSummaries } from '../shared/resolveInstructorSummaries';

const router: RouterType = Router();

const STUDIO_OFFERINGS_MANAGE_CAPABILITY = 'studio-offerings:manage';

// Year-to-year copy. Nothing here is a special "copy" record - the wizard reads a preview of the
// source year (what can be copied, and what's already been copied into the destination) and then
// posts one request that creates ordinary Course/Class documents in the destination year. Those
// carry a copiedFromId link back to their source, which is what lets a later preview mark them
// "already copied". There's no cross-collection transaction in this codebase's provider-agnostic db
// layer, so a request that fails partway can leave some courses copied and others not; everything is
// created as a draft and the link makes a re-run skip what already landed, so that's recoverable.

const normalizeName = (name: string): string => name.trim().toLowerCase();

const describeClass = (classItem: ClassEntity): string => classItem.variantLabel || `${classItem.daysOfWeek.join('/')} ${classItem.startTime}`;

// A source year's semesters map onto the destination year's by term slot (Summer/Fall to Summer/Fall,
// Winter/Spring to Winter/Spring) - that's what "same scope" means across two different years.
// `complete` is false if any of the given semesters has no counterpart, so a caller can refuse to
// copy something it can't place rather than silently narrowing its scope.
const mapSemestersToDestination = (
  semesterIds: string[],
  sourceSemesters: SemesterEntity[],
  destinationSemesters: SemesterEntity[],
): { semesters: SemesterEntity[]; complete: boolean } => {
  const terms = pickSemesters(sourceSemesters, semesterIds).map((semester) => semester.term);
  const semesters = destinationSemesters.filter((semester) => terms.includes(semester.term));
  return { semesters, complete: terms.length === semesterIds.length && semesters.length === terms.length };
};

// An AcademicYearContext whose year is known to exist.
type LoadedYear = AcademicYearContext & { academicYear: NonNullable<AcademicYearContext['academicYear']> };

const loadYearContexts = async (
  sourceAcademicYearId: string,
  destinationAcademicYearId: string,
): Promise<{ source: LoadedYear; destination: LoadedYear }> => {
  if (sourceAcademicYearId === destinationAcademicYearId) {
    throw ValidationError('Choose two different academic years');
  }
  const loadContext = createAcademicYearContextLoader();
  const [source, destination] = await Promise.all([loadContext(sourceAcademicYearId), loadContext(destinationAcademicYearId)]);
  if (!source.academicYear) throw NotFoundError('Source academic year not found');
  if (!destination.academicYear) throw NotFoundError('Destination academic year not found');
  return { source: { ...source, academicYear: source.academicYear }, destination: { ...destination, academicYear: destination.academicYear } };
};

router.get(
  '/api/studio-offerings/copy-preview',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const sourceAcademicYearId = typeof req.query['sourceAcademicYearId'] === 'string' ? req.query['sourceAcademicYearId'] : '';
    const destinationAcademicYearId = typeof req.query['destinationAcademicYearId'] === 'string' ? req.query['destinationAcademicYearId'] : '';
    if (!sourceAcademicYearId || !destinationAcademicYearId) {
      throw ValidationError('sourceAcademicYearId and destinationAcademicYearId are required');
    }

    const { source, destination } = await loadYearContexts(sourceAcademicYearId, destinationAcademicYearId);
    const [sourceCourses, destinationCourses] = await Promise.all([
      listCoursesByAcademicYearId(sourceAcademicYearId),
      listCoursesByAcademicYearId(destinationAcademicYearId),
    ]);
    const [sourceClasses, destinationClasses] = await Promise.all([
      listClassesByCourseIds(sourceCourses.map((course) => course.id)),
      listClassesByCourseIds(destinationCourses.map((course) => course.id)),
    ]);

    // Resolved once for the whole preview rather than per class - the same handful of instructors
    // teach most of a year's classes.
    const instructorIds = [...new Set(sourceClasses.flatMap((classItem) => classItem.instructorIds))];
    const instructorById = new Map((await resolveInstructorSummaries(instructorIds)).map((instructor) => [instructor.id, instructor]));

    // A destination course that's already a copy of this one wins over one that merely shares its
    // name - a renamed copy is still that course's copy.
    const findDestinationMatch = (course: CourseEntity) => {
      const copy = destinationCourses.find((candidate) => candidate.copiedFromId === course.id);
      if (copy) return { course: copy, reason: 'copied' as const };
      const sameName = destinationCourses.find((candidate) => normalizeName(candidate.name) === normalizeName(course.name));
      return sameName ? { course: sameName, reason: 'same-name' as const } : undefined;
    };

    const courses = sourceCourses.map((course) => {
      const match = findDestinationMatch(course);
      const scope = mapSemestersToDestination(course.semesterIds, source.semesters, destination.semesters);

      const classes = sourceClasses
        .filter((classItem) => classItem.courseId === course.id)
        .sort((a, b) => describeClass(a).localeCompare(describeClass(b)))
        .map((classItem) => ({
          id: classItem.id,
          variantLabel: classItem.variantLabel,
          daysOfWeek: classItem.daysOfWeek,
          startTime: classItem.startTime,
          endTime: classItem.endTime,
          minAgeYears: classItem.minAgeYears,
          maxAgeYears: classItem.maxAgeYears,
          priceAmount: classItem.priceAmount,
          capacity: classItem.capacity,
          isPublished: classItem.isPublished,
          semesters: pickSemesters(source.semesters, classItem.semesterIds).map(toSemesterSummary),
          spansFullYear: coversWholeYear(source.semesters, classItem.semesterIds),
          instructors: classItem.instructorIds.flatMap((id) => instructorById.get(id) ?? []).map(({ id, name }) => ({ id, name })),
          alreadyCopied: match
            ? destinationClasses.some((candidate) => candidate.courseId === match.course.id && candidate.copiedFromId === classItem.id)
            : false,
        }));

      return {
        id: course.id,
        name: course.name,
        description: course.description,
        categories: course.categories,
        imageUrl: course.imageUrl,
        isPublished: course.isPublished,
        semesters: pickSemesters(source.semesters, course.semesterIds).map(toSemesterSummary),
        spansFullYear: coversWholeYear(source.semesters, course.semesterIds),
        canCopy: scope.complete,
        ...(scope.complete ? {} : { cannotCopyReason: "The destination year doesn't have a semester matching this course's" }),
        destinationMatch: match
          ? {
              courseId: match.course.id,
              name: match.course.name,
              reason: match.reason,
              isPublished: match.course.isPublished,
              semesters: pickSemesters(destination.semesters, match.course.semesterIds).map(toSemesterSummary),
              spansFullYear: coversWholeYear(destination.semesters, match.course.semesterIds),
            }
          : null,
        classes,
      };
    });

    res.status(200).json(
      createSuccessResponse({
        sourceAcademicYear: { id: source.academicYear.id, title: source.academicYear.title },
        destinationAcademicYear: {
          id: destination.academicYear.id,
          title: destination.academicYear.title,
          semesters: destination.semesters.map(toSemesterSummary),
        },
        courses,
      }),
    );
  }),
);

interface ClassSkip {
  classId: string;
  label: string;
  reason: string;
}

interface CopyCourseResult {
  sourceCourseId: string;
  courseName: string;
  outcome: 'created' | 'merged' | 'failed';
  courseId?: string;
  classesCreated: number;
  classesSkipped: ClassSkip[];
  warnings: string[];
  error?: string;
}

interface CopyContext {
  source: LoadedYear;
  destination: LoadedYear;
  // Whether a staff id still resolves - cached across the request, since one instructor typically
  // teaches many of the classes being copied.
  isStaffMember: (id: string) => Promise<boolean>;
}

const failedResult = (sourceCourseId: string, courseName: string, error: string): CopyCourseResult => ({
  sourceCourseId,
  courseName,
  outcome: 'failed',
  classesCreated: 0,
  classesSkipped: [],
  warnings: [],
  error,
});

const copyOneCourse = async (
  entry: { sourceCourseId: string; target: { mode: 'create' } | { mode: 'existing'; courseId: string }; classIds: string[] },
  { source, destination, isStaffMember }: CopyContext,
): Promise<CopyCourseResult> => {
  const sourceCourse = await getCourseById(entry.sourceCourseId);
  if (!sourceCourse || sourceCourse.academicYearId !== source.academicYear.id) {
    return failedResult(entry.sourceCourseId, entry.sourceCourseId, 'This course is not in the source academic year');
  }

  const scope = mapSemestersToDestination(sourceCourse.semesterIds, source.semesters, destination.semesters);
  if (!scope.complete) {
    return failedResult(sourceCourse.id, sourceCourse.name, "The destination year doesn't have a semester matching this course's");
  }

  const warnings: string[] = [];
  let targetCourse: CourseEntity;
  if (entry.target.mode === 'existing') {
    const existing = await getCourseById(entry.target.courseId);
    if (!existing || existing.academicYearId !== destination.academicYear.id) {
      return failedResult(sourceCourse.id, sourceCourse.name, 'The course to add to is not in the destination academic year');
    }
    targetCourse = existing;
  } else {
    const { image, warning } = await duplicateCourseImage(sourceCourse);
    if (warning) warnings.push(`${sourceCourse.name}: ${warning}`);
    targetCourse = await createCourse({
      academicYearId: destination.academicYear.id,
      semesterIds: scope.semesters.map((semester) => semester.id),
      name: sourceCourse.name,
      description: sourceCourse.description,
      categories: sourceCourse.categories,
      ...image,
      copiedFromId: sourceCourse.id,
      isPublished: false,
    });
  }

  const result: CopyCourseResult = {
    sourceCourseId: sourceCourse.id,
    courseName: sourceCourse.name,
    outcome: entry.target.mode === 'existing' ? 'merged' : 'created',
    courseId: targetCourse.id,
    classesCreated: 0,
    classesSkipped: [],
    warnings,
  };
  if (entry.classIds.length === 0) return result;

  const [sourceClasses, targetClasses] = await Promise.all([listClassesByCourseIds([sourceCourse.id]), listClassesByCourseIds([targetCourse.id])]);

  for (const classId of entry.classIds) {
    const classItem = sourceClasses.find((candidate) => candidate.id === classId);
    if (!classItem) {
      result.classesSkipped.push({ classId, label: classId, reason: 'Not a class of this course' });
      continue;
    }
    const label = describeClass(classItem);

    const classScope = mapSemestersToDestination(classItem.semesterIds, source.semesters, destination.semesters);
    if (!classScope.complete) {
      result.classesSkipped.push({ classId, label, reason: "The destination year doesn't have a matching semester" });
      continue;
    }
    if (!classScope.semesters.every((semester) => targetCourse.semesterIds.includes(semester.id))) {
      result.classesSkipped.push({ classId, label, reason: "Runs in a semester the destination course doesn't" });
      continue;
    }
    if (targetClasses.some((candidate) => candidate.copiedFromId === classItem.id)) {
      result.classesSkipped.push({ classId, label, reason: 'Already copied to this course' });
      continue;
    }

    const stillOnStaff = await Promise.all(classItem.instructorIds.map(isStaffMember));
    const instructorIds = classItem.instructorIds.filter((_, index) => stillOnStaff[index]);
    const dropped = classItem.instructorIds.length - instructorIds.length;
    if (dropped > 0) {
      warnings.push(`${sourceCourse.name} - ${label}: ${dropped} instructor${dropped === 1 ? '' : 's'} no longer on staff ${dropped === 1 ? 'was' : 'were'} left off`);
    }

    try {
      await createClass({
        courseId: targetCourse.id,
        semesterIds: classScope.semesters.map((semester) => semester.id),
        variantLabel: classItem.variantLabel,
        instructorIds,
        daysOfWeek: classItem.daysOfWeek,
        startTime: classItem.startTime,
        endTime: classItem.endTime,
        // The copy runs the whole destination semester (first start to last end for a both-semester
        // class) - shifting last year's dates by a year would drift the weekdays. The registration
        // date is left unset so it follows the new semester's own default.
        startDate: new Date(Math.min(...classScope.semesters.map((semester) => semester.startDate.getTime()))),
        endDate: new Date(Math.max(...classScope.semesters.map((semester) => semester.endDate.getTime()))),
        minAgeYears: classItem.minAgeYears,
        maxAgeYears: classItem.maxAgeYears,
        priceAmount: classItem.priceAmount,
        capacity: classItem.capacity,
        enrolled: 0,
        copiedFromId: classItem.id,
        isPublished: false,
      });
      result.classesCreated += 1;
    } catch {
      result.classesSkipped.push({ classId, label, reason: 'Could not be saved' });
    }
  }

  return result;
};

router.post(
  '/api/studio-offerings/copy',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = copyOfferingsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const { source, destination } = await loadYearContexts(parsed.data.sourceAcademicYearId, parsed.data.destinationAcademicYearId);

    const staffChecks = new Map<string, Promise<boolean>>();
    const isStaffMember = (id: string): Promise<boolean> => {
      const cached = staffChecks.get(id);
      if (cached) return cached;
      const pending = getStaffById(id).then((staff) => staff !== null);
      staffChecks.set(id, pending);
      return pending;
    };

    // Sequential, not Promise.all: keeps result order stable and means two entries never race to
    // create courses/classes in the same destination year.
    const results: CopyCourseResult[] = [];
    for (const entry of parsed.data.courses) {
      try {
        results.push(await copyOneCourse(entry, { source, destination, isStaffMember }));
      } catch {
        results.push(failedResult(entry.sourceCourseId, entry.sourceCourseId, 'Something went wrong copying this course'));
      }
    }

    res.status(200).json(
      createSuccessResponse({
        results,
        totals: {
          coursesCreated: results.filter((result) => result.outcome === 'created').length,
          coursesMerged: results.filter((result) => result.outcome === 'merged').length,
          coursesFailed: results.filter((result) => result.outcome === 'failed').length,
          classesCreated: results.reduce((sum, result) => sum + result.classesCreated, 0),
          classesSkipped: results.reduce((sum, result) => sum + result.classesSkipped.length, 0),
        },
      }),
    );
  }),
);

export default router;
