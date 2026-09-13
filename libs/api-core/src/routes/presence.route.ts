import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { getPresence } from '@inithium/realtime';

const router: RouterType = Router();

// Snapshot endpoint for the instant between page load and the WS gateway's first
// `presence:update` event - see @inithium/api-client's usePresence hook, which calls this once
// per userId and then lets live WS events take over.
router.get(
  '/api/users/:id/presence',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    // Express 5 types route params as `string | string[]` to allow for repeated
    // segments (e.g. ":id+"); ":id" is a single simple segment, so it will only
    // ever be a plain string at runtime — normalize the type here.
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      throw ValidationError('User id is required');
    }
    res.status(200).json(createSuccessResponse(getPresence(id)));
  })
);

export default router;
