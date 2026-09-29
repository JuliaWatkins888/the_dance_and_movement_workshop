import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import {
  addCartLine,
  applyCartDiscountCode,
  clearCart,
  getCartView,
  removeCartDiscountCode,
  removeCartLine,
  updateCartLineQuantity,
} from '@inithium/ecommerce';
import { addCartLineSchema, applyDiscountCodeSchema, updateCartLineSchema } from '../../schemas/ecommerce.schema';
import { currentUserId, normalizeParam, parseBody } from './ecommerceHttp';

const router: RouterType = Router();

// Every cart route answers with the full, freshly priced CartView, so the client never has to
// recompute totals after a change.
router.use('/api/cart', requireAuth);

router.get(
  '/api/cart',
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await getCartView(currentUserId(req))));
  }),
);

router.post(
  '/api/cart/lines',
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(addCartLineSchema, req.body);
    res.status(200).json(createSuccessResponse(await addCartLine(currentUserId(req), body)));
  }),
);

router.patch(
  '/api/cart/lines/:lineId',
  asyncHandler(async (req: Request, res: Response) => {
    const { quantity } = parseBody(updateCartLineSchema, req.body);
    res
      .status(200)
      .json(createSuccessResponse(await updateCartLineQuantity(currentUserId(req), normalizeParam(req.params['lineId']), quantity)));
  }),
);

router.delete(
  '/api/cart/lines/:lineId',
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await removeCartLine(currentUserId(req), normalizeParam(req.params['lineId']))));
  }),
);

router.delete(
  '/api/cart',
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await clearCart(currentUserId(req))));
  }),
);

// The "check discount" endpoint: validates the code against this cart's current contents and
// attaches it, or answers 400 with the reason it doesn't apply.
router.put(
  '/api/cart/discount',
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = parseBody(applyDiscountCodeSchema, req.body);
    res.status(200).json(createSuccessResponse(await applyCartDiscountCode(currentUserId(req), code)));
  }),
);

router.delete(
  '/api/cart/discount',
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await removeCartDiscountCode(currentUserId(req))));
  }),
);

export default router;
