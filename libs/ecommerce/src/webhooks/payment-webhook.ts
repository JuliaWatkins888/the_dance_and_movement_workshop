import express, { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, logError } from '@inithium/api-utils';
import { getOrderRepository, getPaymentEventRepository } from '@inithium/db';
import { getPaymentProvider } from '@inithium/payments';
import type { PaymentEventOutcome } from '@inithium/db';
import type { PaymentWebhookEvent } from '@inithium/payments';
import { failOrder, finalizeOrder } from '../checkout/order-lifecycle';
import { handleSubscriptionWebhookEvent } from '../subscriptions/subscription.service';

export const PAYMENT_WEBHOOK_PATH = '/api/payments/webhook';

const findEventOrder = async (paymentId: string, orderId: string | undefined) =>
  (orderId ? await getOrderRepository().findById(orderId) : null) ?? getOrderRepository().findByPaymentId(paymentId);

// Returns what the event was about, so the CMS payment-health log can point at it.
const dispatch = async (event: PaymentWebhookEvent): Promise<PaymentEventOutcome> => {
  switch (event.kind) {
    case 'payment.succeeded': {
      const order = await findEventOrder(event.paymentId, event.orderId);
      if (order?.status === 'pending') await finalizeOrder(order.id);
      return { reference: event.paymentId, ...(order ? { orderId: order.id } : {}) };
    }
    case 'payment.failed': {
      const order = await findEventOrder(event.paymentId, event.orderId);
      if (order?.status === 'pending') await failOrder(order.id, event.reason ?? 'Payment failed');
      return { reference: event.paymentId, ...(order ? { orderId: order.id } : {}) };
    }
    case 'ignored':
      return {};
    default:
      await handleSubscriptionWebhookEvent(event);
      return { reference: event.providerSubscriptionId };
  }
};

export type PaymentWebhookOutcome = 'processed' | 'duplicate' | 'invalid_signature';

export const processPaymentWebhook = async (rawBody: Buffer, signature: string): Promise<PaymentWebhookOutcome> => {
  const provider = getPaymentProvider();
  const events = getPaymentEventRepository();
  const event = provider.parseWebhookEvent(rawBody, signature);
  if (!event) {
    // The usual cause is a rotated webhook signing secret; the CMS payment-health screen reports it.
    await events.recordRejected(provider.name).catch(logError);
    return 'invalid_signature';
  }

  if (!(await events.claim(provider.name, event.eventId, event.eventType))) return 'duplicate';

  let outcome: PaymentEventOutcome;
  try {
    outcome = await dispatch(event);
  } catch (error) {
    // Marked failed (not processed) so the provider's automatic retry can claim it again.
    await events.markFailed(provider.name, event.eventId, error instanceof Error ? error.message : String(error));
    throw error;
  }
  await events.markProcessed(provider.name, event.eventId, outcome);
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
