import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { createWorkshop, deleteWorkshop, getSemesterById, listPublishedWorkshops, listWorkshops, updateWorkshop } from '@inithium/db';
import type { WorkshopEntity, WorkshopSearchField } from '@inithium/db';
import { createWorkshopSchema, updateWorkshopSchema } from '../schemas/workshops.schema';
import { resolveInstructorSummaries } from '../shared/resolveInstructorSummaries';

const router: RouterType = Router();

const STUDIO_OFFERINGS_MANAGE_CAPABILITY = 'studio-offerings:manage';

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const SEARCH_FIELDS = ['name'] as const;
const isSearchField = (value: unknown): value is WorkshopSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

// A Workshop never stores its own copy of the Semester's name/dates or the instructors' names -
// both resolved at response time, mirroring courses.route.ts's toCourseDto and staff.route.ts's
// toStaffDto respectively.
const toWorkshopDto = async (workshop: WorkshopEntity) => {
  const [semester, instructors] = await Promise.all([getSemesterById(workshop.semesterId), resolveInstructorSummaries(workshop.instructorIds)]);
  return {
    ...workshop,
    semesterName: semester?.name ?? '',
    instructors,
    openings: Math.max(0, workshop.capacity - workshop.enrolled),
    // Falls back to the semester's default registration-open date when the workshop has none of
    // its own - see classes.route.ts's toClassDto for the identical rationale.
    effectiveRegistrationOpensAt: workshop.registrationStartDate ?? semester?.registrationOpensAt,
  };
};

// Public, unpaged - like classes.route.ts and courses.route.ts, the full published workshop
// catalog is small enough to fetch whole and let the public WorkshopsPage group/filter it
// client-side (already sorted by earliest occurrence date - see workshop.repository.ts). Optional
// ?instructorId= narrows to one Staff member's own workshops, used by the Staff Detail page.
router.get(
  '/api/workshops',
  asyncHandler(async (req: Request, res: Response) => {
    const instructorId = typeof req.query['instructorId'] === 'string' ? req.query['instructorId'] : undefined;
    const workshops = await listPublishedWorkshops(instructorId ? { instructorId } : undefined);
    res.status(200).json(createSuccessResponse(await Promise.all(workshops.map(toWorkshopDto))));
  }),
);

// Registered before "/api/workshops/:id" - literal segments ahead of a param route, the same
// ordering classes.route.ts/courses.route.ts use for their own literal routes.
router.get(
  '/api/workshops/admin',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query['page']) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query['pageSize']) || 20));
    const rawSearch = typeof req.query['search'] === 'string' ? req.query['search'].trim() : undefined;
    const rawSearchField = req.query['searchField'];
    const searchField = isSearchField(rawSearchField) ? rawSearchField : 'name';
    const semesterId = typeof req.query['semesterId'] === 'string' ? req.query['semesterId'] : undefined;

    const result = await listWorkshops({
      page,
      pageSize,
      search: rawSearch || undefined,
      searchField: rawSearch ? searchField : undefined,
      semesterId,
    });
    const items = await Promise.all(result.items.map(toWorkshopDto));

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
  '/api/workshops',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createWorkshopSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const semester = await getSemesterById(parsed.data.semesterId);
    if (!semester) {
      throw NotFoundError('Linked semester not found');
    }

    const { registrationStartDate, enrolled, isPublished, occurrences, ...rest } = parsed.data;
    const workshop = await createWorkshop({
      ...rest,
      occurrences: occurrences.map((occurrence) => ({ ...occurrence, date: new Date(occurrence.date) })),
      registrationStartDate: registrationStartDate ? new Date(registrationStartDate) : undefined,
      enrolled: enrolled ?? 0,
      isPublished: isPublished ?? true,
    });
    res.status(201).json(createSuccessResponse(await toWorkshopDto(workshop)));
  }),
);

router.put(
  '/api/workshops/:id',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const parsed = updateWorkshopSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    if (parsed.data.semesterId) {
      const semester = await getSemesterById(parsed.data.semesterId);
      if (!semester) {
        throw NotFoundError('Linked semester not found');
      }
    }

    const { registrationStartDate, occurrences, ...rest } = parsed.data;
    const workshop = await updateWorkshop(id, {
      ...rest,
      ...(occurrences !== undefined ? { occurrences: occurrences.map((occurrence) => ({ ...occurrence, date: new Date(occurrence.date) })) } : {}),
      ...(registrationStartDate !== undefined ? { registrationStartDate: new Date(registrationStartDate) } : {}),
    });
    if (!workshop) {
      throw NotFoundError('Workshop not found');
    }
    res.status(200).json(createSuccessResponse(await toWorkshopDto(workshop)));
  }),
);

router.delete(
  '/api/workshops/:id',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const deleted = await deleteWorkshop(id);
    if (!deleted) {
      throw NotFoundError('Workshop not found');
    }
    res.status(204).send();
  }),
);

export default router;
