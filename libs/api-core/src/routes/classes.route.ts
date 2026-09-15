import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { createClass, deleteClass, listClasses, listPublishedClasses, updateClass } from '@inithium/db';
import type { ClassEntity, ClassSearchField } from '@inithium/db';
import { createClassSchema, updateClassSchema } from '../schemas/classes.schema';

const router: RouterType = Router();

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const SEARCH_FIELDS = ['name'] as const;
const isSearchField = (value: unknown): value is ClassSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

// Adds the one value derived rather than stored - openings is always capacity minus enrolled, so
// computing it once here keeps every consumer (public page, CMS list) from re-deriving it (and
// from ever reading negative if enrolled were to exceed capacity).
const toClassDto = (classItem: ClassEntity) => ({
  ...classItem,
  openings: Math.max(0, classItem.capacity - classItem.enrolled),
});

// Reading the catalog isn't sensitive - it's meant for every site visitor - so like
// policy.route.ts there's a single public, unpaged read (the ClassesPage fetches the whole
// published catalog and does search/filter/pagination client-side); only the admin listing below
// and the mutations are gated.
router.get(
  '/api/classes',
  asyncHandler(async (_req: Request, res: Response) => {
    const classes = await listPublishedClasses();
    res.status(200).json(createSuccessResponse(classes.map(toClassDto)));
  }),
);

// Registered before "/api/classes/:id" - literal segments ahead of a param route, the same
// ordering staff.route.ts/gallery.route.ts use for their own literal routes (Express matches in
// registration order).
router.get(
  '/api/classes/admin',
  requireAuth,
  requirePermission('classes:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query['page']) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query['pageSize']) || 20));
    const rawSearch = typeof req.query['search'] === 'string' ? req.query['search'].trim() : undefined;
    const rawSearchField = req.query['searchField'];
    const searchField = isSearchField(rawSearchField) ? rawSearchField : 'name';

    const result = await listClasses({
      page,
      pageSize,
      search: rawSearch || undefined,
      searchField: rawSearch ? searchField : undefined,
    });

    res.status(200).json(
      createSuccessResponse(result.items.map(toClassDto), {
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
  requirePermission('classes:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createClassSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
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
    res.status(201).json(createSuccessResponse(toClassDto(classItem)));
  }),
);

router.put(
  '/api/classes/:id',
  requireAuth,
  requirePermission('classes:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const parsed = updateClassSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
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
    res.status(200).json(createSuccessResponse(toClassDto(classItem)));
  }),
);

router.delete(
  '/api/classes/:id',
  requireAuth,
  requirePermission('classes:manage'),
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
