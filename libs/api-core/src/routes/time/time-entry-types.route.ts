import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, ConflictError, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import {
  countTimeEntriesByTypeId,
  countTimeEntryTypes,
  createTimeEntryType,
  deleteTimeEntryType,
  findTimeEntryTypeById,
  listTimeEntryTypes,
  updateTimeEntryType,
} from '@inithium/db';
import type { TimeEntryTypeEntity } from '@inithium/db';
import { createEntryTypeSchema, updateEntryTypeSchema } from '../../schemas/time.schema';
import { normalizeParam, requireAnyCapability } from './timeAccess';

const router: RouterType = Router();

const toEntryTypeDto = (type: TimeEntryTypeEntity) => ({
  id: type.id,
  label: type.label,
  order: type.order,
  createdAt: type.createdAt.toISOString(),
  updatedAt: type.updatedAt.toISOString(),
});

// Readable by either capability - every employee needs the type list to pick from when clocking
// in, not just a time:manage actor. Self-seeding: the first ever caller gets "General" for free
// (see @inithium/db's listTimeEntryTypes).
router.get(
  '/api/time/entry-types',
  requireAuth,
  requireAnyCapability('time:track', 'time:manage'),
  asyncHandler(async (_req: Request, res: Response) => {
    const types = await listTimeEntryTypes();
    res.status(200).json(createSuccessResponse(types.map(toEntryTypeDto)));
  }),
);

router.post(
  '/api/time/entry-types',
  requireAuth,
  requirePermission('time:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createEntryTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }
    const type = await createTimeEntryType(parsed.data);
    res.status(201).json(createSuccessResponse(toEntryTypeDto(type)));
  }),
);

router.patch(
  '/api/time/entry-types/:id',
  requireAuth,
  requirePermission('time:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const parsed = updateEntryTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }
    const updated = await updateTimeEntryType(id, parsed.data);
    if (!updated) {
      throw NotFoundError('Time entry type not found');
    }
    res.status(200).json(createSuccessResponse(toEntryTypeDto(updated)));
  }),
);

router.delete(
  '/api/time/entry-types/:id',
  requireAuth,
  requirePermission('time:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const type = await findTimeEntryTypeById(id);
    if (!type) {
      throw NotFoundError('Time entry type not found');
    }

    const [totalTypes, entriesUsingType] = await Promise.all([countTimeEntryTypes(), countTimeEntriesByTypeId(id)]);
    if (totalTypes <= 1) {
      throw ConflictError('At least one time entry type must always exist');
    }
    if (entriesUsingType > 0) {
      throw ConflictError('This type is used by existing time entries and cannot be deleted');
    }

    await deleteTimeEntryType(id);
    res.status(204).send();
  }),
);

export default router;
