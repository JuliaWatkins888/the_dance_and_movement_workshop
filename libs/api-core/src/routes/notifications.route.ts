import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import {
  listNotificationsForUser,
  countUnreadNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsReadForUser,
  deleteNotificationForUser,
} from '@inithium/db';

const router: RouterType = Router();

router.get(
  '/api/notifications',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const notifications = await listNotificationsForUser(req.user!.sub);
    res.status(200).json(createSuccessResponse(notifications));
  })
);

router.get(
  '/api/notifications/unread-count',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const count = await countUnreadNotificationsForUser(req.user!.sub);
    res.status(200).json(createSuccessResponse({ count }));
  })
);

router.patch(
  '/api/notifications/:id/read',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    // Express 5 types route params as `string | string[]` to allow for repeated
    // segments (e.g. ":id+"); ":id" is a single simple segment, so it will only
    // ever be a plain string at runtime — normalize the type here.
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      throw ValidationError('Notification id is required');
    }
    const notification = await markNotificationAsRead(id, req.user!.sub);
    if (!notification) {
      throw NotFoundError('Notification not found');
    }
    res.status(200).json(createSuccessResponse(notification));
  })
);

router.patch(
  '/api/notifications/read-all',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const count = await markAllNotificationsAsReadForUser(req.user!.sub);
    res.status(200).json(createSuccessResponse({ count }));
  })
);

router.delete(
  '/api/notifications/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      throw ValidationError('Notification id is required');
    }
    const deleted = await deleteNotificationForUser(id, req.user!.sub);
    if (!deleted) {
      throw NotFoundError('Notification not found');
    }
    res.status(204).send();
  })
);

export default router;
