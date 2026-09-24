import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { getSemesterById, listSemesters, updateSemester } from '@inithium/db';
import type { SemesterEntity, SemesterSearchField } from '@inithium/db';
import { updateSemesterSchema } from '../schemas/semesters.schema';
import { createAcademicYearContextLoader } from '../shared/academicContext';
import type { AcademicYearContextLoader } from '../shared/academicContext';

const router: RouterType = Router();

const STUDIO_OFFERINGS_MANAGE_CAPABILITY = 'studio-offerings:manage';

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const SEARCH_FIELDS = ['name'] as const;
const isSearchField = (value: unknown): value is SemesterSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

// A Semester never stores its parent year's title - resolved at response time, and tolerant of a
// year that has since gone missing the same way every other toDto in this codebase is.
const toSemesterDto = async (semester: SemesterEntity, loadContext: AcademicYearContextLoader) => {
  const { academicYear } = await loadContext(semester.academicYearId);
  return { ...semester, academicYearTitle: academicYear?.title ?? '' };
};

// Semester has no public tier at all - a site visitor only encounters one through its parent year's
// public payload (academic-years.route.ts). Semesters are also never created or deleted on their own:
// they're stood up in pairs when an academic year is created and removed with it, so this module
// only lists and edits them.
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
    const academicYearId = typeof req.query['academicYearId'] === 'string' ? req.query['academicYearId'] : undefined;

    const result = await listSemesters({
      page,
      pageSize,
      search: rawSearch || undefined,
      searchField: rawSearch ? searchField : undefined,
      academicYearId,
    });
    const loadContext = createAcademicYearContextLoader();
    const items = await Promise.all(result.items.map((semester) => toSemesterDto(semester, loadContext)));

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

    const existing = await getSemesterById(id);
    if (!existing) {
      throw NotFoundError('Semester not found');
    }

    const { registrationOpensAt, startDate, endDate, ...rest } = parsed.data;
    const nextStartDate = startDate !== undefined ? new Date(startDate) : existing.startDate;
    const nextEndDate = endDate !== undefined ? new Date(endDate) : existing.endDate;
    if (nextEndDate < nextStartDate) {
      throw ValidationError('Invalid request body', { fieldErrors: { endDate: ['endDate must be on or after startDate'] } });
    }

    const semester = await updateSemester(id, {
      ...rest,
      ...(registrationOpensAt !== undefined ? { registrationOpensAt: new Date(registrationOpensAt) } : {}),
      ...(startDate !== undefined ? { startDate: nextStartDate } : {}),
      ...(endDate !== undefined ? { endDate: nextEndDate } : {}),
    });
    if (!semester) {
      throw NotFoundError('Semester not found');
    }
    res.status(200).json(createSuccessResponse(await toSemesterDto(semester, createAcademicYearContextLoader())));
  }),
);

export default router;
