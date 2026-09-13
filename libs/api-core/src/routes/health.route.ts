import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

router.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok' });
});

export default router;
