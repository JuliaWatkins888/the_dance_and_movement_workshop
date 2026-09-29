import { randomUUID } from 'node:crypto';
import { ConflictError, logError } from '@inithium/api-utils';
import {
  getBillingSubscriptionRepository,
  getCartRepository,
  getDiscountRepository,
  getOrderRepository,
} from '@inithium/db';
import type { OrderDiscountSnapshot, OrderEntity, OrderLine } from '@inithium/db';
import { getPaymentProvider, getTaxProvider } from '@inithium/payments';
import type { SubscriptionCoupon } from '@inithium/payments';
import { findPurchasableSource } from '../purchasables/registry';
import type { PurchasableContext, PurchasableLineRef } from '../purchasables/purchasable.contract';
import { findPaymentCustomerId } from './payment-customer';

// A pending order older than this is an abandoned checkout (e.g. a 3-D Secure prompt never
// completed) - its reservations are released and its payment voided.
const PENDING_ORDER_TTL_MS = 30 * 60_000;

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const orderLineRef = (line: OrderLine): PurchasableLineRef => ({
  sourceType: line.sourceType,
  sourceId: line.sourceId,
  ...(line.variantId ? { variantId: line.variantId } : {}),
  options: line.options,
  quantity: line.quantity,
});

const contextFor = (order: OrderEntity): PurchasableContext => ({ userId: order.userId, now: new Date() });

const releaseLines = async (order: OrderEntity, lines: OrderLine[]): Promise<void> => {
  const ctx = contextFor(order);
  await Promise.all(
    lines.map(async (line) => {
      const source = findPurchasableSource(line.sourceType);
      if (!source?.release) return;
      try {
        await source.release(orderLineRef(line), ctx);
      } catch (error) {
        logError(error);
      }
    }),
  );
};

export const failOrder = async (orderId: string, reason: string): Promise<OrderEntity | null> => {
  const failed = await getOrderRepository().transitionStatus(orderId, ['pending'], {
    status: 'failed',
    at: new Date(),
    note: reason,
  });
  if (!failed) return null;
  await releaseLines(
    failed,
    failed.lines.filter((line) => line.reserved),
  );
  return failed;
};

// Claims stock/seats line by line right before payment. On the first shortfall everything already
// claimed is given back and the order fails, so nothing is ever charged for an item that can't be
// delivered.
export const reserveOrderLines = async (order: OrderEntity): Promise<OrderEntity> => {
  const ctx = contextFor(order);
  const reserved: OrderLine[] = [];

  for (const line of order.lines) {
    const source = findPurchasableSource(line.sourceType);
    if (!source?.reserve) continue;

    const claimed = await source.reserve(orderLineRef(line), ctx);
    if (!claimed) {
      await releaseLines(order, reserved);
      await getOrderRepository().transitionStatus(order.id, ['pending'], {
        status: 'failed',
        at: new Date(),
        note: `Insufficient availability for "${line.name}"`,
      });
      throw ConflictError(`"${line.name}" is no longer available in the requested quantity.`);
    }
    reserved.push(line);
  }

  const reservedIds = new Set(reserved.map((line) => line.id));
  const updated = await getOrderRepository().update(order.id, {
    lines: order.lines.map((line) => ({ ...line, reserved: reservedIds.has(line.id) })),
  });
  return updated ?? order;
};

// The promo code's per-period discount carried onto a subscription item. 'once' codes (and lines
// the code never touched) were fully spent on the checkout charge.
const couponFor = (discount: OrderDiscountSnapshot | undefined, line: OrderLine): SubscriptionCoupon | undefined => {
  if (!discount || discount.duration === 'once' || line.billing.type !== 'recurring') return undefined;
  if (line.billing.recurringDiscountCents <= 0) return undefined;
  return {
    kind: discount.kind,
    value: discount.kind === 'percent' ? discount.value : line.billing.recurringDiscountCents,
    duration: discount.duration,
    ...(discount.durationInMonths ? { durationInMonths: discount.durationInMonths } : {}),
  };
};

const recurringGroupKey = (line: OrderLine): string =>
  line.billing.type === 'recurring'
    ? [
        line.billing.interval,
        line.billing.intervalCount,
        new Date(line.billing.firstBillingAt).toISOString(),
        line.billing.endsAt ? new Date(line.billing.endsAt).toISOString() : '',
      ].join('|')
    : '';

// One provider subscription per distinct renewal schedule, one item per purchased line. The first
// period was already paid by the checkout charge, so each subscription's first charge is its
// firstBillingAt.
const createOrderSubscriptions = async (order: OrderEntity, errors: string[]): Promise<string[]> => {
  const recurringLines = order.lines.filter((line) => line.billing.type === 'recurring');
  if (recurringLines.length === 0) return [];

  const provider = getPaymentProvider();
  const customerId = await findPaymentCustomerId(order.userId);
  const paymentMethodId = order.payment.paymentMethodId;
  if (!customerId || !paymentMethodId) {
    errors.push('Subscriptions: no saved payment method to bill renewals against - renewals were not scheduled.');
    return [];
  }

  const groups = recurringLines.reduce<Map<string, OrderLine[]>>((acc, line) => {
    const key = recurringGroupKey(line);
    return acc.set(key, [...(acc.get(key) ?? []), line]);
  }, new Map());

  const subscriptionIds: string[] = [];
  let groupIndex = 0;
  for (const lines of groups.values()) {
    const billing = lines[0].billing;
    groupIndex += 1;
    if (billing.type !== 'recurring') continue;

    try {
      const created = await provider.createSubscription({
        customerId,
        paymentMethodId,
        currency: order.currency,
        interval: billing.interval,
        intervalCount: billing.intervalCount,
        firstBillingAt: new Date(billing.firstBillingAt),
        ...(billing.endsAt ? { endsAt: new Date(billing.endsAt) } : {}),
        items: lines.map((line) => {
          const coupon = couponFor(order.discount, line);
          return {
            reference: line.id,
            name: line.name,
            unitAmountCents: line.billing.type === 'recurring' ? line.billing.recurringUnitAmountCents : line.unitAmountCents,
            quantity: line.quantity,
            ...(line.taxCode ? { taxCode: line.taxCode } : {}),
            ...(coupon ? { coupon } : {}),
          };
        }),
        metadata: { orderId: order.id, userId: order.userId },
        idempotencyKey: `order-${order.id}-subscription-${groupIndex}`,
      });

      const itemByReference = new Map(created.items.map((item) => [item.reference, item.providerItemId]));
      const subscription = await getBillingSubscriptionRepository().create({
        userId: order.userId,
        orderId: order.id,
        currency: order.currency,
        provider: provider.name,
        providerSubscriptionId: created.providerSubscriptionId,
        status: created.status,
        interval: billing.interval,
        intervalCount: billing.intervalCount,
        ...(created.currentPeriodEnd ? { currentPeriodEnd: created.currentPeriodEnd } : {}),
        ...(billing.endsAt ? { endsAt: new Date(billing.endsAt) } : {}),
        lines: lines.map((line) => ({
          id: randomUUID(),
          orderLineId: line.id,
          sourceType: line.sourceType,
          sourceId: line.sourceId,
          ...(line.variantId ? { variantId: line.variantId } : {}),
          options: line.options,
          name: line.name,
          unitAmountCents: line.billing.type === 'recurring' ? line.billing.recurringUnitAmountCents : line.unitAmountCents,
          quantity: line.quantity,
          providerItemId: itemByReference.get(line.id) ?? '',
          status: 'active' as const,
        })),
      });
      subscriptionIds.push(subscription.id);
    } catch (error) {
      logError(error);
      errors.push(`Subscription for ${lines.map((line) => `"${line.name}"`).join(', ')}: ${errorMessage(error)}`);
    }
  }

  return subscriptionIds;
};

// Runs every post-payment step exactly once, whichever caller gets here first (the checkout
// request, the confirm call after 3-D Secure, the payment webhook, or the stale sweep) - the
// pending->paid compare-and-set decides the winner. The money is already captured, so a failing
// step is recorded on the order for an admin rather than failing it.
export const finalizeOrder = async (orderId: string, paymentMethodId?: string): Promise<OrderEntity | null> => {
  const orders = getOrderRepository();
  if (paymentMethodId) {
    const current = await orders.findById(orderId);
    if (current?.status === 'pending') {
      await orders.update(orderId, { payment: { ...current.payment, paymentMethodId } });
    }
  }

  const paid = await orders.transitionStatus(orderId, ['pending'], { status: 'paid', at: new Date() });
  if (!paid) return orders.findById(orderId);

  const errors: string[] = [];
  const attempt = async (label: string, step: () => Promise<void>): Promise<void> => {
    try {
      await step();
    } catch (error) {
      logError(error);
      errors.push(`${label}: ${errorMessage(error)}`);
    }
  };

  const { taxCalculationId } = paid.payment;
  if (taxCalculationId) {
    await attempt('Tax record', () => getTaxProvider().commit(taxCalculationId, paid.id));
  }

  const { discount } = paid;
  if (discount) {
    await attempt('Promo code redemption', async () => {
      const counted = await getDiscountRepository().incrementRedemptions(discount.discountId);
      if (!counted) throw new Error(`"${discount.code}" was already at its usage limit when this order was paid`);
    });
  }

  const subscriptionIds = await createOrderSubscriptions(paid, errors);

  for (const line of paid.lines) {
    const source = findPurchasableSource(line.sourceType);
    if (source?.onPaid) {
      await attempt(`Fulfillment for "${line.name}"`, () => source.onPaid!(line, paid));
    }
  }

  // Only a shopper's own checkout came from their cart - a staff-recorded order must never touch
  // the customer's cart or the promo code they may have applied there.
  if (paid.kind === 'checkout') await attempt('Cart cleanup', async () => {
    const carts = getCartRepository();
    await carts.removeLines(
      paid.userId,
      paid.lines.map((line) => line.cartLineId).filter((id): id is string => Boolean(id)),
    );
    if (discount) {
      const cart = await carts.findByUserId(paid.userId);
      if (cart?.discountCode === discount.code) await carts.save(paid.userId, { discountCode: null });
    }
  });

  return orders.update(paid.id, {
    subscriptionIds: [...paid.subscriptionIds, ...subscriptionIds],
    fulfillmentErrors: [...paid.fulfillmentErrors, ...errors],
  });
};

// Lazy, like the time plugin's auto-clockout: there's no job runner, so abandoned checkouts are
// swept whenever a new checkout starts. Voiding the payment first means a 3-D Secure challenge
// completed after the sweep can't charge for an order whose stock was already released.
export const sweepStalePendingOrders = async (): Promise<void> => {
  const stale = await getOrderRepository().findPendingCreatedBefore(new Date(Date.now() - PENDING_ORDER_TTL_MS));
  const provider = getPaymentProvider();

  await Promise.all(
    stale.map(async (order) => {
      try {
        if (!order.payment.paymentId) {
          await failOrder(order.id, 'Checkout abandoned');
          return;
        }
        const result = await provider.cancelPayment(order.payment.paymentId);
        if (result.status === 'succeeded') {
          await finalizeOrder(order.id, result.paymentMethodId);
        } else if (result.status !== 'processing') {
          await failOrder(order.id, 'Checkout abandoned');
        }
      } catch (error) {
        logError(error);
      }
    }),
  );
};
