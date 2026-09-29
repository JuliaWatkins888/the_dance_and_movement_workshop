import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { BILLING_SUBSCRIPTION_STATUSES, getBillingSubscriptionRepository, getUserRepository } from '@inithium/db';
import type { BillingSubscriptionEntity, BillingSubscriptionStatus } from '@inithium/db';
import { cancelSubscriptionByAdmin, cancelSubscriptionLine, listUserSubscriptions } from '@inithium/ecommerce';
import { currentUserId, normalizeParam, paginatedResponse, parsePaging, queryString } from './ecommerceHttp';

const router: RouterType = Router();
const MANAGE = 'ecommerce:manage-orders';

// Admin views resolve the subscriber at response time, like the admin order views.
const toAdminSubscriptionDto = async (subscription: BillingSubscriptionEntity) => {
  const user = await getUserRepository().findById(subscription.userId);
  return {
    ...subscription,
    customer: { id: subscription.userId, firstName: user?.firstName ?? '', lastName: user?.lastName, email: user?.email ?? '' },
  };
};

const isSubscriptionStatus = (value: unknown): value is BillingSubscriptionStatus =>
  typeof value === 'string' && (BILLING_SUBSCRIPTION_STATUSES as readonly string[]).includes(value);

router.get(
  '/api/subscriptions/mine',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await listUserSubscriptions(currentUserId(req))));
  }),
);

// Stops billing one line immediately, without proration or credit (the paid period is kept); the
// last line cancels the whole subscription. Workspace-level flows (e.g. dropping a class) call
// @inithium/ecommerce's cancelSubscriptionLinesForSource instead.
router.delete(
  '/api/subscriptions/mine/:id/lines/:lineId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const subscription = await cancelSubscriptionLine(
      currentUserId(req),
      normalizeParam(req.params['id']),
      normalizeParam(req.params['lineId']),
    );
    res.status(200).json(createSuccessResponse(subscription));
  }),
);

router.get(
  '/api/subscriptions/admin',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, pageSize } = parsePaging(req);
    const status = req.query['status'];
    const userId = queryString(req, 'userId');
    const result = await getBillingSubscriptionRepository().findMany({
      page,
      pageSize,
      ...(isSubscriptionStatus(status) ? { status } : {}),
      ...(userId ? { userId } : {}),
    });
    res.status(200).json(paginatedResponse(result, await Promise.all(result.items.map(toAdminSubscriptionDto))));
  }),
);

router.post(
  '/api/subscriptions/admin/:id/cancel',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const subscription = await cancelSubscriptionByAdmin(normalizeParam(req.params['id']));
    res.status(200).json(createSuccessResponse(await toAdminSubscriptionDto(subscription)));
  }),
);

export default router;
