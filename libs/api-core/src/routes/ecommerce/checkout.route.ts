import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { confirmOrderPayment, placeOrder, quoteCheckout } from '@inithium/ecommerce';
import type { PlaceOrderResult } from '@inithium/ecommerce';
import { checkoutDetailsSchema, placeOrderSchema } from '../../schemas/ecommerce.schema';
import { currentUserId, normalizeParam, parseBody } from './ecommerceHttp';

const router: RouterType = Router();

router.use('/api/checkout', requireAuth);

const statusCodeFor = (result: PlaceOrderResult): number => (result.status === 'paid' ? 201 : 202);

// Priced, taxed preview for the given shipping choice and addresses - nothing is reserved or
// charged. Its totalCents is what POST /api/checkout expects back as expectedTotalCents.
router.post(
  '/api/checkout/quote',
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(checkoutDetailsSchema, req.body);
    res.status(200).json(createSuccessResponse(await quoteCheckout(currentUserId(req), body)));
  }),
);

// 201 paid | 202 requires_action (finish with clientSecret, then call confirm) | 202 processing
// (the payment webhook completes it) | 409 total changed (details.quote holds the new one).
router.post(
  '/api/checkout',
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(placeOrderSchema, req.body);
    const result = await placeOrder(currentUserId(req), body);
    res.status(statusCodeFor(result)).json(createSuccessResponse(result));
  }),
);

router.post(
  '/api/checkout/orders/:orderId/confirm',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await confirmOrderPayment(currentUserId(req), normalizeParam(req.params['orderId']));
    res.status(statusCodeFor(result)).json(createSuccessResponse(result));
  }),
);

export default router;
