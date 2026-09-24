import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { createClass, deleteClass, getClassById, getCourseById, listClassesUnpaged, listPublishedClasses, updateClass } from '@inithium/db';
import type { ClassEntity, ClassSearchField, CourseEntity } from '@inithium/db';
import { createClassSchema, updateClassSchema } from '../schemas/classes.schema';
import { coversWholeYear, createAcademicYearContextLoader, pickSemesters, toSemesterSummary } from '../shared/academicContext';
import type { AcademicYearContextLoader } from '../shared/academicContext';
import { computeClassPricing, getPricingConfig } from '../shared/classPricing';
import type { PricingConfig } from '../shared/classPricing';
import { resolveInstructorSummaries } from '../shared/resolveInstructorSummaries';

const router: RouterType = Router();

const STUDIO_OFFERINGS_MANAGE_CAPABILITY = 'studio-offerings:manage';

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const SEARCH_FIELDS = ['variantLabel'] as const;
const isSearchField = (value: unknown): value is ClassSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

// A Class never stores its own copy of its Course's name, its academic year's title, or its
// semesters' names/dates - a 2-hop resolve (courseId -> Course -> academicYearId -> AcademicYear +
// Semesters), plus instructor names resolved the same way courses.route.ts/workshops.route.ts
// resolve their own FKs. Tolerates a deleted Course/AcademicYear the same way every other toDto in
// this codebase tolerates an orphaned FK - empty/undefined fallbacks, never a thrown error that
// would break the whole list over one bad record.
//
// `pricing` is derived, never stored: the class's monthly priceAmount plus the studio-wide discount
// settings (see classPricing.ts). isPubliclyVisible is kept out of the DTO - it only gates the
// public list.
const resolveClass = async (classItem: ClassEntity, loadContext: AcademicYearContextLoader, pricingConfig: PricingConfig) => {
  const course = await getCourseById(classItem.courseId);
  const [context, instructors] = await Promise.all([
    course ? loadContext(course.academicYearId) : Promise.resolve(null),
    resolveInstructorSummaries(classItem.instructorIds),
  ]);

  const yearSemesters = context?.semesters ?? [];
  const classSemesters = pickSemesters(yearSemesters, classItem.semesterIds);
  const spansFullYear = coversWholeYear(yearSemesters, classItem.semesterIds);

  return {
    dto: {
      ...classItem,
      courseName: course?.name ?? '',
      courseDescription: course?.description,
      academicYearId: course?.academicYearId ?? '',
      academicYearTitle: context?.academicYear?.title ?? '',
      semesters: classSemesters.map(toSemesterSummary),
      spansFullYear,
      instructors,
      openings: Math.max(0, classItem.capacity - classItem.enrolled),
      // The class's own registrationStartDate wins when set; otherwise falls back to the semester
      // default of the first (earliest) semester it runs in - a full-year class opens for
      // registration with its first term. Documented on the CMS form as "leave blank to use the
      // semester's default" - this is what actually implements that. Resolving which date applies
      // isn't itself time-dependent, so it's safe to compute once here rather than re-deriving the
      // fallback on every client; whether that resolved date has actually passed *is* time-dependent
      // and is left to the browser's own clock (apps/web's registrationStatus.ts), not baked into a
      // cacheable API response.
      effectiveRegistrationOpensAt: classItem.registrationStartDate ?? classSemesters[0]?.registrationOpensAt,
      pricing: computeClassPricing(classItem.priceAmount, spansFullYear, pricingConfig),
    },
    isPubliclyVisible: context?.academicYear?.isPublished === true && classSemesters.some((semester) => semester.isPublished),
  };
};

type ResolvedClassDto = Awaited<ReturnType<typeof resolveClass>>['dto'];

// Alphabetized the same way coursesApi's own listCoursesAdmin sorts Courses (by name) - Class has
// no name of its own to sort by at the DB level (see class.contract.ts's own note), so this runs
// after resolveClass has resolved each one's parent courseName, ordering by that name first and its
// variantLabel second (e.g. all "Ballet" classes grouped together, "Ages 7-10" before "Beginning,
// Ages 11+" within that group).
const compareByCourseNameThenVariant = (a: ResolvedClassDto, b: ResolvedClassDto): number =>
  a.courseName.localeCompare(b.courseName) || (a.variantLabel ?? '').localeCompare(b.variantLabel ?? '');

// A class can only run in semesters its course runs in - see class.contract.ts's semesterIds note.
const assertSemestersWithinCourse = (semesterIds: string[], course: CourseEntity): void => {
  if (!semesterIds.every((semesterId) => course.semesterIds.includes(semesterId))) {
    throw ValidationError('A class can only run in semesters its course runs in');
  }
};

// Public so the CMS's live price preview and any future registration screen read the same rules the
// API applies - the discounts are editable studio-wide settings, so clients can't hardcode them.
// Registered ahead of every other /api/classes route, literal segments before params.
router.get(
  '/api/classes/pricing-config',
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await getPricingConfig()));
  }),
);

// Reading the catalog isn't sensitive - it's meant for every site visitor - so like
// courses.route.ts there's a single public, unpaged read (the Course Detail page fetches a
// course's variants and does no further pagination, matching the "small catalog" precedent every
// other public listing in this codebase already follows); only the admin listing below and the
// mutations are gated. Optional ?courseId= narrows to one Course's variants; optional
// ?instructorId= narrows to one Staff member's own sections, used by the Staff Detail page.
router.get(
  '/api/classes',
  asyncHandler(async (req: Request, res: Response) => {
    const courseId = typeof req.query['courseId'] === 'string' ? req.query['courseId'] : undefined;
    const instructorId = typeof req.query['instructorId'] === 'string' ? req.query['instructorId'] : undefined;
    const classes = await listPublishedClasses(courseId || instructorId ? { courseId, instructorId } : undefined);

    const loadContext = createAcademicYearContextLoader();
    const pricingConfig = await getPricingConfig();
    const resolved = await Promise.all(classes.map((classItem) => resolveClass(classItem, loadContext, pricingConfig)));
    const items = resolved.filter((entry) => entry.isPubliclyVisible).map((entry) => entry.dto);
    res.status(200).json(createSuccessResponse(items.sort(compareByCourseNameThenVariant)));
  }),
);

// Registered before "/api/classes/:id" - literal segments ahead of a param route, the same
// ordering staff.route.ts/gallery.route.ts use for their own literal routes (Express matches in
// registration order).
router.get(
  '/api/classes/admin',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query['page']) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query['pageSize']) || 20));
    const rawSearch = typeof req.query['search'] === 'string' ? req.query['search'].trim() : undefined;
    const rawSearchField = req.query['searchField'];
    const searchField = isSearchField(rawSearchField) ? rawSearchField : 'variantLabel';
    const courseId = typeof req.query['courseId'] === 'string' ? req.query['courseId'] : undefined;

    // Fetches the whole matching set (unpaged) rather than paginating at the DB level - the sort
    // key (courseName) only exists once resolveClass resolves it below, so pagination has to happen
    // after that resolve+sort, not before it. Small catalog, same "fetch whole, process in
    // application code" precedent this codebase already uses for every public listing.
    const matching = await listClassesUnpaged({
      search: rawSearch || undefined,
      searchField: rawSearch ? searchField : undefined,
      courseId,
    });
    const loadContext = createAcademicYearContextLoader();
    const pricingConfig = await getPricingConfig();
    const sorted = (await Promise.all(matching.map((classItem) => resolveClass(classItem, loadContext, pricingConfig))))
      .map((entry) => entry.dto)
      .sort(compareByCourseNameThenVariant);

    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);

    res.status(200).json(
      createSuccessResponse(items, {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      }),
    );
  }),
);

router.post(
  '/api/classes',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createClassSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const course = await getCourseById(parsed.data.courseId);
    if (!course) {
      throw NotFoundError('Linked course not found');
    }
    assertSemestersWithinCourse(parsed.data.semesterIds, course);

    const { registrationStartDate, startDate, endDate, enrolled, isPublished, ...rest } = parsed.data;
    const classItem = await createClass({
      ...rest,
      registrationStartDate: registrationStartDate ? new Date(registrationStartDate) : undefined,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      enrolled: enrolled ?? 0,
      isPublished: isPublished ?? true,
    });
    const resolved = await resolveClass(classItem, createAcademicYearContextLoader(), await getPricingConfig());
    res.status(201).json(createSuccessResponse(resolved.dto));
  }),
);

router.put(
  '/api/classes/:id',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const parsed = updateClassSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const existing = await getClassById(id);
    if (!existing) {
      throw NotFoundError('Class not found');
    }

    // The course/semesters pair has to stay consistent as a whole, so a partial update that changes
    // either half is re-validated against the other half's effective (new-or-existing) value.
    if (parsed.data.courseId !== undefined || parsed.data.semesterIds !== undefined) {
      const course = await getCourseById(parsed.data.courseId ?? existing.courseId);
      if (!course) {
        throw NotFoundError('Linked course not found');
      }
      assertSemestersWithinCourse(parsed.data.semesterIds ?? existing.semesterIds, course);
    }

    const { registrationStartDate, startDate, endDate, ...rest } = parsed.data;
    const classItem = await updateClass(id, {
      ...rest,
      ...(registrationStartDate !== undefined ? { registrationStartDate: new Date(registrationStartDate) } : {}),
      ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
      ...(endDate !== undefined ? { endDate: new Date(endDate) } : {}),
    });
    if (!classItem) {
      throw NotFoundError('Class not found');
    }
    const resolved = await resolveClass(classItem, createAcademicYearContextLoader(), await getPricingConfig());
    res.status(200).json(createSuccessResponse(resolved.dto));
  }),
);

router.delete(
  '/api/classes/:id',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const deleted = await deleteClass(id);
    if (!deleted) {
      throw NotFoundError('Class not found');
    }
    res.status(204).send();
  }),
);

export default router;
