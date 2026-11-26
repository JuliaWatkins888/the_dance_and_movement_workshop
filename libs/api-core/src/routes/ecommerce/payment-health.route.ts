import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { getPaymentEventRepository, getUserRepository, PAYMENT_EVENT_STATUSES } from '@inithium/db';
import type { BillingSubscriptionEntity, OrderEntity, PaymentEventStatus, UserEntity } from '@inithium/db';
import { getPaymentHealth } from '@inithium/ecommerce';
import { paginatedResponse, parsePaging } from './ecommerceHttp';

const router: RouterType = Router();
const MANAGE = 'ecommerce:manage-orders';

const isEventStatus = (value: unknown): value is PaymentEventStatus =>
  typeof value === 'string' && (PAYMENT_EVENT_STATUSES as readonly string[]).includes(value);

const toPerson = (user: UserEntity | undefined, id: string) => ({
  id,
  firstName: user?.firstName ?? '',
  lastName: user?.lastName,
  email: user?.email ?? '',
});

const loadUsers = async (userIds: string[]): Promise<Map<string, UserEntity>> => {
  const users = await Promise.all([...new Set(userIds)].map((id) => getUserRepository().findById(id)));
  return new Map(users.filter((user): user is UserEntity => user !== null).map((user) => [user.id, user]));
};

const toStuckOrderDto = (order: OrderEntity, users: Map<string, UserEntity>) => ({
  id: order.id,
  kind: order.kind,
  currency: order.currency,
  totalCents: order.totals.totalCents,
  paymentId: order.payment.paymentId,
  itemNames: order.lines.map((line) => line.name),
  createdAt: order.createdAt,
  customer: toPerson(users.get(order.userId), order.userId),
});

const toPastDueDto = (subscription: BillingSubscriptionEntity, users: Map<string, UserEntity>) => ({
  id: subscription.id,
  orderId: subscription.orderId,
  currency: subscription.currency,
  providerSubscriptionId: subscription.providerSubscriptionId,
  currentPeriodEnd: subscription.currentPeriodEnd,
  monthlyCents: subscription.lines
    .filter((line) => line.status === 'active')
    .reduce((sum, line) => sum + line.unitAmountCents * line.quantity, 0),
  itemNames: subscription.lines.filter((line) => line.status === 'active').map((line) => line.name),
  customer: toPerson(users.get(subscription.userId), subscription.userId),
});

// Everything the CMS needs to tell whether payments work, without server access. Calls Stripe
// (two cheap reads), so the CMS only loads it on demand.
router.get(
  '/api/admin/payments/health',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (_req: Request, res: Response) => {
    const report = await getPaymentHealth();
    const users = await loadUsers([
      ...report.stuckOrders.items.map((order) => order.userId),
      ...report.pastDueSubscriptions.items.map((subscription) => subscription.userId),
    ]);
    res.status(200).json(
      createSuccessResponse({
        ...report,
        stuckOrders: { total: report.stuckOrders.total, items: report.stuckOrders.items.map((order) => toStuckOrderDto(order, users)) },
        pastDueSubscriptions: {
          total: report.pastDueSubscriptions.total,
          items: report.pastDueSubscriptions.items.map((subscription) => toPastDueDto(subscription, users)),
        },
      }),
    );
  }),
);

// Received webhook events, newest activity first.
router.get(
  '/api/admin/payments/events',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, pageSize } = parsePaging(req);
    const status = req.query['status'];
    const result = await getPaymentEventRepository().findMany({ page, pageSize, ...(isEventStatus(status) ? { status } : {}) });
    res.status(200).json(paginatedResponse(result, result.items));
  }),
);

export default router;
