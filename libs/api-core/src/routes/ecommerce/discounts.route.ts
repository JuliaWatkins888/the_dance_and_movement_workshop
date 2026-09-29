import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, ConflictError, createSuccessResponse, NotFoundError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { getDiscountRepository } from '@inithium/db';
import { purchasableSources } from '@inithium/ecommerce';
import { createDiscountSchema, updateDiscountSchema } from '../../schemas/ecommerce.schema';
import { normalizeParam, paginatedResponse, parseBody, parsePaging, queryString } from './ecommerceHttp';

const router: RouterType = Router();
const MANAGE = 'ecommerce:manage-discounts';

// Admin-only in full: shoppers never list codes, they only apply one to their cart
// (PUT /api/cart/discount), which is where eligibility is checked.
router.use('/api/discounts', requireAuth, requirePermission(MANAGE));

router.get(
  '/api/discounts',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, pageSize } = parsePaging(req);
    const search = queryString(req, 'search');
    const result = await getDiscountRepository().findMany({ page, pageSize, ...(search ? { search, searchField: 'code' } : {}) });
    res.status(200).json(paginatedResponse(result, result.items));
  }),
);

// Every registered purchasable source type (product, plus whatever a workspace adds - class,
// ticket, ...), so item-scoped codes can target a type without the CMS hardcoding the list.
// Registered ahead of "/api/discounts/:id".
router.get(
  '/api/discounts/source-types',
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(purchasableSources.map((source) => source.sourceType)));
  }),
);

router.get(
  '/api/discounts/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const discount = await getDiscountRepository().findById(normalizeParam(req.params['id']));
    if (!discount) throw NotFoundError('Discount not found');
    res.status(200).json(createSuccessResponse(discount));
  }),
);

router.post(
  '/api/discounts',
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(createDiscountSchema, req.body);
    if (await getDiscountRepository().findByCode(body.code)) throw ConflictError('A discount with this code already exists');
    res.status(201).json(createSuccessResponse(await getDiscountRepository().create(body)));
  }),
);

router.put(
  '/api/discounts/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params['id']);
    const body = parseBody(updateDiscountSchema, req.body);
    if (body.code) {
      const existing = await getDiscountRepository().findByCode(body.code);
      if (existing && existing.id !== id) throw ConflictError('A discount with this code already exists');
    }
    const discount = await getDiscountRepository().update(id, body);
    if (!discount) throw NotFoundError('Discount not found');
    res.status(200).json(createSuccessResponse(discount));
  }),
);

// Orders snapshot the code and amounts, and live subscriptions carry their own provider coupon,
// so deleting a discount never alters history or active billing - it only stops new use.
router.delete(
  '/api/discounts/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const deleted = await getDiscountRepository().delete(normalizeParam(req.params['id']));
    if (!deleted) throw NotFoundError('Discount not found');
    res.status(204).send();
  }),
);

export default router;
