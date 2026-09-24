import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, ConflictError, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import {
  countCoursesByAcademicYearId,
  countWorkshopsBySemesterIds,
  createAcademicYear,
  createSemester,
  deleteAcademicYear,
  deleteSemestersByAcademicYearId,
  getAcademicYearById,
  listAcademicYearsUnpaged,
  listPublishedAcademicYears,
  listSemestersByAcademicYearId,
  SEMESTER_TERMS,
  SEMESTER_TERM_LABELS,
  updateAcademicYear,
} from '@inithium/db';
import type { AcademicYearEntity, AcademicYearSearchField, SemesterEntity } from '@inithium/db';
import { createAcademicYearSchema, updateAcademicYearSchema } from '../schemas/academic-years.schema';
import { getAcademicYearSpan, toSemesterSummary } from '../shared/academicContext';

const router: RouterType = Router();

const STUDIO_OFFERINGS_MANAGE_CAPABILITY = 'studio-offerings:manage';

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const SEARCH_FIELDS = ['title'] as const;
const isSearchField = (value: unknown): value is AcademicYearSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

// A year stores no dates of its own - startDate/endDate here are the span of whichever of its
// semesters the caller passes in (all of them for the admin listing, only the published ones for
// the public one), so a hidden semester never stretches what a visitor sees.
const toAcademicYearDto = (academicYear: AcademicYearEntity, semesters: SemesterEntity[]) => ({
  ...academicYear,
  ...getAcademicYearSpan(semesters),
  semesters: semesters.map(toSemesterSummary),
});

type AcademicYearDto = ReturnType<typeof toAcademicYearDto>;

const compareByStartDate = (a: AcademicYearDto, b: AcademicYearDto): number =>
  (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0);

// Public and unpaged, like the other catalog reads: powers the "which year?" dropdown on the
// browse page. Only published years that are in session or still to come - a year is over once its
// last semester's end date has passed - and only their published semesters.
router.get(
  '/api/academic-years',
  asyncHandler(async (_req: Request, res: Response) => {
    const now = Date.now();
    const years = await listPublishedAcademicYears();
    const dtos = await Promise.all(
      years.map(async (year) => {
        const semesters = (await listSemestersByAcademicYearId(year.id)).filter((semester) => semester.isPublished);
        return toAcademicYearDto(year, semesters);
      }),
    );

    const current = dtos.filter((dto) => dto.endDate !== undefined && dto.endDate.getTime() >= now);
    res.status(200).json(createSuccessResponse(current.sort(compareByStartDate)));
  }),
);

// Registered before "/api/academic-years/:id" - literal segments ahead of a param route, the same
// ordering courses.route.ts/classes.route.ts use.
router.get(
  '/api/academic-years/admin',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query['page']) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query['pageSize']) || 20));
    const rawSearch = typeof req.query['search'] === 'string' ? req.query['search'].trim() : undefined;
    const rawSearchField = req.query['searchField'];
    const searchField = isSearchField(rawSearchField) ? rawSearchField : 'title';

    // Fetches the whole matching set and paginates after sorting - the sort key (the year's
    // earliest semester start) only exists once its semesters are resolved. Newest year first.
    const years = await listAcademicYearsUnpaged(rawSearch ? { search: rawSearch, searchField } : undefined);
    const dtos = await Promise.all(years.map(async (year) => toAcademicYearDto(year, await listSemestersByAcademicYearId(year.id))));
    const sorted = dtos.sort((a, b) => compareByStartDate(b, a));

    const total = sorted.length;
    const start = (page - 1) * pageSize;

    res.status(200).json(
      createSuccessResponse(sorted.slice(start, start + pageSize), {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      }),
    );
  }),
);

// Creating a year also stands up its two semesters - they're never created on their own (the
// Semesters module is edit-only), so a year always has exactly one semester per term.
router.post(
  '/api/academic-years',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createAcademicYearSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const { semesters: semesterDates, isPublished, ...rest } = parsed.data;
    const academicYear = await createAcademicYear({ ...rest, isPublished: isPublished ?? true });

    try {
      const semesters: SemesterEntity[] = [];
      for (const term of SEMESTER_TERMS) {
        const { startDate, endDate, registrationOpensAt } = semesterDates[term];
        semesters.push(
          await createSemester({
            academicYearId: academicYear.id,
            term,
            // "Summer/Fall 2026", "Winter/Spring 2027" - named for the calendar year it starts in.
            name: `${SEMESTER_TERM_LABELS[term]} ${startDate.slice(0, 4)}`,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            registrationOpensAt: registrationOpensAt ? new Date(registrationOpensAt) : undefined,
            isPublished: true,
          }),
        );
      }
      res.status(201).json(createSuccessResponse(toAcademicYearDto(academicYear, semesters)));
    } catch (error) {
      // No cross-collection transaction here (the db layer is provider-agnostic), so a failure
      // partway through undoes what was already written instead of leaving a year with a missing
      // semester that the edit-only Semesters module could never repair.
      await deleteSemestersByAcademicYearId(academicYear.id);
      await deleteAcademicYear(academicYear.id);
      throw error;
    }
  }),
);

router.put(
  '/api/academic-years/:id',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const parsed = updateAcademicYearSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const academicYear = await updateAcademicYear(id, parsed.data);
    if (!academicYear) {
      throw NotFoundError('Academic year not found');
    }
    res.status(200).json(createSuccessResponse(toAcademicYearDto(academicYear, await listSemestersByAcademicYearId(id))));
  }),
);

router.delete(
  '/api/academic-years/:id',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);

    const academicYear = await getAcademicYearById(id);
    if (!academicYear) {
      throw NotFoundError('Academic year not found');
    }

    const semesters = await listSemestersByAcademicYearId(id);
    const [courseCount, workshopCount] = await Promise.all([
      countCoursesByAcademicYearId(id),
      countWorkshopsBySemesterIds(semesters.map((semester) => semester.id)),
    ]);
    if (courseCount > 0 || workshopCount > 0) {
      throw ConflictError(
        `This academic year still has ${courseCount} course${courseCount === 1 ? '' : 's'} and ${workshopCount} workshop${workshopCount === 1 ? '' : 's'} - remove or move them first`,
      );
    }

    await deleteSemestersByAcademicYearId(id);
    await deleteAcademicYear(id);
    res.status(204).send();
  }),
);

export default router;
