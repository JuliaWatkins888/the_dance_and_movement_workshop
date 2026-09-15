import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { createClass, deleteClass, getCourseById, getSemesterById, listClasses, listPublishedClasses, updateClass } from '@inithium/db';
import type { ClassEntity, ClassSearchField } from '@inithium/db';
import { createClassSchema, updateClassSchema } from '../schemas/classes.schema';
import { resolveInstructorSummaries } from '../shared/resolveInstructorSummaries';

const router: RouterType = Router();

const STUDIO_OFFERINGS_MANAGE_CAPABILITY = 'studio-offerings:manage';

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const SEARCH_FIELDS = ['variantLabel'] as const;
const isSearchField = (value: unknown): value is ClassSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

// A Class never stores its own copy of its Course's or Semester's name - a 2-hop resolve
// (courseId -> Course -> semesterId -> Semester), plus instructor names resolved the same way
// courses.route.ts/workshops.route.ts resolve their own FKs. Tolerates a deleted Course/Semester
// the same way every other toDto in this codebase tolerates an orphaned FK - empty/undefined
// fallbacks, never a thrown error that would break the whole list over one bad record.
const toClassDto = async (classItem: ClassEntity) => {
  const course = await getCourseById(classItem.courseId);
  const [semester, instructors] = await Promise.all([
    course ? getSemesterById(course.semesterId) : Promise.resolve(null),
    resolveInstructorSummaries(classItem.instructorIds),
  ]);

  return {
    ...classItem,
    courseName: course?.name ?? '',
    courseDescription: course?.description,
    semesterId: course?.semesterId ?? '',
    semesterName: semester?.name ?? '',
    instructors,
    openings: Math.max(0, classItem.capacity - classItem.enrolled),
  };
};

// Reading the catalog isn't sensitive - it's meant for every site visitor - so like
// courses.route.ts there's a single public, unpaged read (the Course Detail page fetches a
// course's variants and does no further pagination, matching the "small catalog" precedent every
// other public listing in this codebase already follows); only the admin listing below and the
// mutations are gated. Optional ?courseId= narrows to one Course's variants.
router.get(
  '/api/classes',
  asyncHandler(async (req: Request, res: Response) => {
    const courseId = typeof req.query['courseId'] === 'string' ? req.query['courseId'] : undefined;
    const classes = await listPublishedClasses(courseId ? { courseId } : undefined);
    res.status(200).json(createSuccessResponse(await Promise.all(classes.map(toClassDto))));
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

    const result = await listClasses({
      page,
      pageSize,
      search: rawSearch || undefined,
      searchField: rawSearch ? searchField : undefined,
      courseId,
    });
    const items = await Promise.all(result.items.map(toClassDto));

    res.status(200).json(
      createSuccessResponse(items, {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
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

    const { registrationStartDate, startDate, endDate, enrolled, isPublished, ...rest } = parsed.data;
    const classItem = await createClass({
      ...rest,
      registrationStartDate: registrationStartDate ? new Date(registrationStartDate) : undefined,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      enrolled: enrolled ?? 0,
      isPublished: isPublished ?? true,
    });
    res.status(201).json(createSuccessResponse(await toClassDto(classItem)));
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

    if (parsed.data.courseId) {
      const course = await getCourseById(parsed.data.courseId);
      if (!course) {
        throw NotFoundError('Linked course not found');
      }
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
    res.status(200).json(createSuccessResponse(await toClassDto(classItem)));
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
