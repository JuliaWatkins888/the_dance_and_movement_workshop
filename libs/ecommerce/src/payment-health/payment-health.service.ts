import { getBillingSubscriptionRepository, getOrderRepository, getPaymentEventRepository } from '@inithium/db';
import type { OrderEntity } from '@inithium/db';
import { getPaymentProvider } from '@inithium/payments';
import { PAYMENT_WEBHOOK_PATH } from '../webhooks/payment-webhook';
import { assessPaymentHealth, LIST_LIMIT, RECENT_WINDOW_MS, STUCK_ORDER_AGE_MS, worstLevel } from './payment-health.rules';
import type { PaymentHealthReport } from './payment-health.rules';

const byCreatedAsc = (a: OrderEntity, b: OrderEntity): number => a.createdAt.getTime() - b.createdAt.getTime();

export const getPaymentHealth = async (now: Date = new Date()): Promise<PaymentHealthReport> => {
  const paymentProvider = getPaymentProvider();
  const events = getPaymentEventRepository();
  const since = new Date(now.getTime() - RECENT_WINDOW_MS);

  const [provider, lastVerifiedEvent, rejectedRecord, failedEventsRecent, stuckOrders, failedOrders, pastDue] = await Promise.all([
    paymentProvider.checkHealth(PAYMENT_WEBHOOK_PATH),
    events.findLatestVerified(paymentProvider.name),
    events.findRejected(paymentProvider.name),
    events.countByStatusSince(paymentProvider.name, 'failed', since),
    getOrderRepository().findPendingCreatedBefore(new Date(now.getTime() - STUCK_ORDER_AGE_MS)),
    getOrderRepository().findMany({ page: 1, pageSize: 1, status: 'failed', from: since }),
    getBillingSubscriptionRepository().findMany({ page: 1, pageSize: LIST_LIMIT, status: 'past_due' }),
  ]);

  const checks = assessPaymentHealth(
    {
      provider,
      webhookPath: PAYMENT_WEBHOOK_PATH,
      isProduction: process.env['NODE_ENV'] === 'production',
      lastVerifiedEvent,
      rejectedRecord,
      failedEventsRecent,
      stuckOrderCount: stuckOrders.length,
      failedOrdersRecent: failedOrders.total,
      pastDueCount: pastDue.total,
    },
    now,
  );

  return {
    status: worstLevel(checks),
    checkedAt: now,
    checks,
    provider,
    webhook: {
      path: PAYMENT_WEBHOOK_PATH,
      ...(lastVerifiedEvent ? { lastReceivedAt: lastVerifiedEvent.createdAt } : {}),
      ...(rejectedRecord ? { lastRejectedAt: rejectedRecord.updatedAt, rejectedCount: rejectedRecord.attempts ?? 0 } : {}),
      failedLast7Days: failedEventsRecent,
    },
    failedOrdersLast7Days: failedOrders.total,
    stuckOrders: { total: stuckOrders.length, items: [...stuckOrders].sort(byCreatedAsc).slice(0, LIST_LIMIT) },
    pastDueSubscriptions: { total: pastDue.total, items: pastDue.items },
  };
};
