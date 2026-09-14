import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import {
  createPolicyCategory,
  createPolicyItem,
  deletePolicyCategory,
  deletePolicyItem,
  listPolicyCategories,
  updatePolicyCategory,
  updatePolicyItem,
} from '@inithium/db';
import {
  createPolicyCategorySchema,
  createPolicyItemSchema,
  updatePolicyCategorySchema,
  updatePolicyItemSchema,
} from '../schemas/policy.schema';

const router: RouterType = Router();

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

// Reading policy text isn't sensitive - it's meant for every site visitor - so there's a single
// public list route used both by the public policies page and the CMS's own list view. Unlike
// staff/gallery there's no pagination, search, or draft state to justify a separate gated
// "/admin" read; only the mutations below are gated.
router.get(
  '/api/policies',
  asyncHandler(async (_req: Request, res: Response) => {
    const categories = await listPolicyCategories();
    res.status(200).json(createSuccessResponse(categories));
  }),
);

router.post(
  '/api/policies/categories',
  requireAuth,
  requirePermission('policies:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createPolicyCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }
    const category = await createPolicyCategory(parsed.data);
    res.status(201).json(createSuccessResponse(category));
  }),
);

router.put(
  '/api/policies/categories/:id',
  requireAuth,
  requirePermission('policies:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const parsed = updatePolicyCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }
    const category = await updatePolicyCategory(id, parsed.data);
    if (!category) {
      throw NotFoundError('Policy category not found');
    }
    res.status(200).json(createSuccessResponse(category));
  }),
);

router.delete(
  '/api/policies/categories/:id',
  requireAuth,
  requirePermission('policies:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const deleted = await deletePolicyCategory(id);
    if (!deleted) {
      throw NotFoundError('Policy category not found');
    }
    res.status(204).send();
  }),
);

router.post(
  '/api/policies/categories/:categoryId/items',
  requireAuth,
  requirePermission('policies:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const categoryId = normalizeParam(req.params.categoryId);
    const parsed = createPolicyItemSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }
    const category = await createPolicyItem(categoryId, parsed.data);
    if (!category) {
      throw NotFoundError('Policy category not found');
    }
    res.status(201).json(createSuccessResponse(category));
  }),
);

router.put(
  '/api/policies/categories/:categoryId/items/:itemId',
  requireAuth,
  requirePermission('policies:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const categoryId = normalizeParam(req.params.categoryId);
    const itemId = normalizeParam(req.params.itemId);
    const parsed = updatePolicyItemSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }
    const category = await updatePolicyItem(categoryId, itemId, parsed.data);
    if (!category) {
      throw NotFoundError('Policy category or item not found');
    }
    res.status(200).json(createSuccessResponse(category));
  }),
);

router.delete(
  '/api/policies/categories/:categoryId/items/:itemId',
  requireAuth,
  requirePermission('policies:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const categoryId = normalizeParam(req.params.categoryId);
    const itemId = normalizeParam(req.params.itemId);
    const category = await deletePolicyItem(categoryId, itemId);
    if (!category) {
      throw NotFoundError('Policy category or item not found');
    }
    res.status(200).json(createSuccessResponse(category));
  }),
);

export default router;
