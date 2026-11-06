import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { BILLING_SUBSCRIPTION_STATUSES, getBillingSubscriptionRepository, getClassRegistrationRepository, getUserRepository } from '@inithium/db';
import type { BillingSubscriptionEntity, BillingSubscriptionStatus } from '@inithium/db';
import { cancelSubscriptionByAdmin, cancelSubscriptionLine, cancelSubscriptionLineByAdmin, listUserSubscriptions } from '@inithium/ecommerce';
import { assertRegistrationWithdrawable } from '../../services/class-withdrawal.service';
import { currentUserId, normalizeParam, paginatedResponse, parsePaging, queryString } from './ecommerceHttp';

const router: RouterType = Router();
const MANAGE = 'ecommerce:manage-orders';

// Admin views resolve the subscriber at response time, like the admin order views.
const toAdminSubscriptionDto = async (subscription: BillingSubscriptionEntity) => {
  const [user, registrations] = await Promise.all([
    getUserRepository().findById(subscription.userId),
    getClassRegistrationRepository().findByUserId(subscription.userId),
  ]);
  // Line names describe the class, so siblings in one class read identically without the dancer.
  const attendeeByLineId = new Map(registrations.map((registration) => [registration.subscriptionLineId, registration.attendee.name]));
  return {
    ...subscription,
    lines: subscription.lines.map((line) => ({ ...line, attendeeName: attendeeByLineId.get(line.id) })),
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
    const userId = currentUserId(req);
    const lineId = normalizeParam(req.params['lineId']);
    // A class line is also a registration, so this path honors the show-semester withdrawal lock.
    const registrations = await getClassRegistrationRepository().findByUserId(userId);
    const registration = registrations.find((candidate) => candidate.subscriptionLineId === lineId);
    if (registration) await assertRegistrationWithdrawable(registration, new Date());

    const subscription = await cancelSubscriptionLine(userId, normalizeParam(req.params['id']), lineId);
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

// Withdraws one dancer without stopping a sibling billed on the same subscription.
router.post(
  '/api/subscriptions/admin/:id/lines/:lineId/cancel',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const subscription = await cancelSubscriptionLineByAdmin(normalizeParam(req.params['id']), normalizeParam(req.params['lineId']));
    res.status(200).json(createSuccessResponse(await toAdminSubscriptionDto(subscription)));
  }),
);

export default router;
