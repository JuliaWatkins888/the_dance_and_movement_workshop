import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse } from '@inithium/api-utils';

const router: RouterType = Router();

router.get(
  '/api/health',
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse({ status: 'ok' }));
  })
);

export default router;
