import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, ConflictError, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { countCoursesBySemesterId, countWorkshopsBySemesterId, createSemester, deleteSemester, listSemesters, updateSemester } from '@inithium/db';
import type { SemesterSearchField } from '@inithium/db';
import { createSemesterSchema, updateSemesterSchema } from '../schemas/semesters.schema';

const router: RouterType = Router();

const STUDIO_OFFERINGS_MANAGE_CAPABILITY = 'studio-offerings:manage';

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const SEARCH_FIELDS = ['name'] as const;
const isSearchField = (value: unknown): value is SemesterSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

// Semester has no public tier at all - unlike Class/Course/Workshop, a site visitor never
// encounters one directly, only indirectly through the Courses/Workshops that reference it. Every
// route here is gated identically, so there's no "/admin" suffix to disambiguate from a public one.
router.get(
  '/api/semesters',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query['page']) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query['pageSize']) || 20));
    const rawSearch = typeof req.query['search'] === 'string' ? req.query['search'].trim() : undefined;
    const rawSearchField = req.query['searchField'];
    const searchField = isSearchField(rawSearchField) ? rawSearchField : 'name';

    const result = await listSemesters({
      page,
      pageSize,
      search: rawSearch || undefined,
      searchField: rawSearch ? searchField : undefined,
    });

    res.status(200).json(
      createSuccessResponse(result.items, {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
      }),
    );
  }),
);

router.post(
  '/api/semesters',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createSemesterSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const { registrationOpensAt, startDate, endDate, isPublished, ...rest } = parsed.data;
    const semester = await createSemester({
      ...rest,
      registrationOpensAt: registrationOpensAt ? new Date(registrationOpensAt) : undefined,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isPublished: isPublished ?? true,
    });
    res.status(201).json(createSuccessResponse(semester));
  }),
);

router.put(
  '/api/semesters/:id',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const parsed = updateSemesterSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const { registrationOpensAt, startDate, endDate, ...rest } = parsed.data;
    const semester = await updateSemester(id, {
      ...rest,
      ...(registrationOpensAt !== undefined ? { registrationOpensAt: new Date(registrationOpensAt) } : {}),
      ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
      ...(endDate !== undefined ? { endDate: new Date(endDate) } : {}),
    });
    if (!semester) {
      throw NotFoundError('Semester not found');
    }
    res.status(200).json(createSuccessResponse(semester));
  }),
);

router.delete(
  '/api/semesters/:id',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);

    const [courseCount, workshopCount] = await Promise.all([countCoursesBySemesterId(id), countWorkshopsBySemesterId(id)]);
    if (courseCount > 0 || workshopCount > 0) {
      throw ConflictError(
        `This semester still has ${courseCount} course${courseCount === 1 ? '' : 's'} and ${workshopCount} workshop${workshopCount === 1 ? '' : 's'} - remove or move them first`,
      );
    }

    const deleted = await deleteSemester(id);
    if (!deleted) {
      throw NotFoundError('Semester not found');
    }
    res.status(204).send();
  }),
);

export default router;
