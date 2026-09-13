import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, ValidationError } from '@inithium/api-utils';

const router: RouterType = Router();

router.get(
  '/api/health',
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse({ status: 'ok' }));
  })
);

router.get(
  '/api/test-error',
  asyncHandler(async () => {
    throw ValidationError('This is a simulated validation error for testing the global error handler', {
      field: 'example',
    });
  })
);

export default router;
