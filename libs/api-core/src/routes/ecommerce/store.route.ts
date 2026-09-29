import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse } from '@inithium/api-utils';
import { getStoreCurrency } from '@inithium/ecommerce';
import { getPaymentProvider } from '@inithium/payments';

const router: RouterType = Router();

// Public storefront configuration: the currency every amount is denominated in, and the payment
// provider's public client settings (null until the provider is configured) - so the web app
// renders prices and payment fields without its own copy of either.
router.get(
  '/api/store/config',
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(
      createSuccessResponse({
        currency: await getStoreCurrency(),
        payment: getPaymentProvider().getClientConfig(),
      }),
    );
  }),
);

export default router;
