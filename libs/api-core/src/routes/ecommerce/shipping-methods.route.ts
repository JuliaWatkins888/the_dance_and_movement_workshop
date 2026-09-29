import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, NotFoundError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { getShippingMethodRepository } from '@inithium/db';
import { createShippingMethodSchema, updateShippingMethodSchema } from '../../schemas/ecommerce.schema';
import { normalizeParam, parseBody } from './ecommerceHttp';

const router: RouterType = Router();
const MANAGE = 'ecommerce:manage-shipping';

router.get(
  '/api/shipping-methods',
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await getShippingMethodRepository().findActive()));
  }),
);

router.get(
  '/api/shipping-methods/admin',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await getShippingMethodRepository().findAll()));
  }),
);

router.post(
  '/api/shipping-methods',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const method = await getShippingMethodRepository().create(parseBody(createShippingMethodSchema, req.body));
    res.status(201).json(createSuccessResponse(method));
  }),
);

router.put(
  '/api/shipping-methods/:id',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const method = await getShippingMethodRepository().update(
      normalizeParam(req.params['id']),
      parseBody(updateShippingMethodSchema, req.body),
    );
    if (!method) throw NotFoundError('Shipping method not found');
    res.status(200).json(createSuccessResponse(method));
  }),
);

// Orders snapshot the method's name and price, so deleting one never alters order history.
router.delete(
  '/api/shipping-methods/:id',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const deleted = await getShippingMethodRepository().delete(normalizeParam(req.params['id']));
    if (!deleted) throw NotFoundError('Shipping method not found');
    res.status(204).send();
  }),
);

export default router;
