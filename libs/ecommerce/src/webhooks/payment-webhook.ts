import express, { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler } from '@inithium/api-utils';
import { getOrderRepository, getPaymentEventRepository } from '@inithium/db';
import { getPaymentProvider } from '@inithium/payments';
import type { PaymentWebhookEvent } from '@inithium/payments';
import { failOrder, finalizeOrder } from '../checkout/order-lifecycle';
import { handleSubscriptionWebhookEvent } from '../subscriptions/subscription.service';

export const PAYMENT_WEBHOOK_PATH = '/api/payments/webhook';

const findEventOrder = async (paymentId: string, orderId: string | undefined) =>
  (orderId ? await getOrderRepository().findById(orderId) : null) ?? getOrderRepository().findByPaymentId(paymentId);

const dispatch = async (event: PaymentWebhookEvent): Promise<void> => {
  switch (event.kind) {
    case 'payment.succeeded': {
      const order = await findEventOrder(event.paymentId, event.orderId);
      if (order?.status === 'pending') await finalizeOrder(order.id);
      return;
    }
    case 'payment.failed': {
      const order = await findEventOrder(event.paymentId, event.orderId);
      if (order?.status === 'pending') await failOrder(order.id, event.reason ?? 'Payment failed');
      return;
    }
    case 'ignored':
      return;
    default:
      await handleSubscriptionWebhookEvent(event);
  }
};

export type PaymentWebhookOutcome = 'processed' | 'duplicate' | 'invalid_signature';

export const processPaymentWebhook = async (rawBody: Buffer, signature: string): Promise<PaymentWebhookOutcome> => {
  const provider = getPaymentProvider();
  const event = provider.parseWebhookEvent(rawBody, signature);
  if (!event) return 'invalid_signature';

  const events = getPaymentEventRepository();
  if (!(await events.claim(provider.name, event.eventId, event.eventType))) return 'duplicate';

  try {
    await dispatch(event);
  } catch (error) {
    // Un-claim so the provider's automatic retry gets processed rather than skipped as a duplicate.
    await events.release(provider.name, event.eventId);
    throw error;
  }
  return 'processed';
};

// Mounted from apps/api/src/main.ts at the pre-body-parser anchor: signature verification needs
// the exact raw bytes, which the global express.json() would otherwise consume first.
export const createPaymentWebhookRouter = (): RouterType => {
  const router: RouterType = Router();
  router.post(
    PAYMENT_WEBHOOK_PATH,
    express.raw({ type: '*/*', limit: '1mb' }),
    asyncHandler(async (req: Request, res: Response) => {
      const header = req.headers[getPaymentProvider().webhookSignatureHeader];
      const signature = Array.isArray(header) ? header[0] : header;
      if (!signature || !Buffer.isBuffer(req.body)) {
        res.status(400).json({ error: 'Missing webhook signature' });
        return;
      }

      const outcome = await processPaymentWebhook(req.body, signature);
      if (outcome === 'invalid_signature') {
        res.status(400).json({ error: 'Invalid webhook signature' });
        return;
      }
      res.status(200).json({ received: true });
    }),
  );
  return router;
};
