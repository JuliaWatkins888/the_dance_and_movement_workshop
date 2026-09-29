import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError, logError } from '@inithium/api-utils';
import { getBillingSubscriptionRepository, getOrderRepository } from '@inithium/db';
import type { BillingSubscriptionEntity, BillingSubscriptionLine, LineOptions, OrderEntity } from '@inithium/db';
import { getPaymentProvider } from '@inithium/payments';
import type { PaymentWebhookEvent } from '@inithium/payments';
import { findPurchasableSource } from '../purchasables/registry';

const LIVE_STATUSES = ['active', 'past_due'];

const isLive = (subscription: BillingSubscriptionEntity): boolean => LIVE_STATUSES.includes(subscription.status);

const activeLines = (subscription: BillingSubscriptionEntity): BillingSubscriptionLine[] =>
  subscription.lines.filter((line) => line.status === 'active');

const notifyLinesEnded = async (subscription: BillingSubscriptionEntity, lines: BillingSubscriptionLine[]): Promise<void> => {
  for (const line of lines) {
    const source = findPurchasableSource(line.sourceType);
    if (!source?.onSubscriptionLineEnded) continue;
    try {
      await source.onSubscriptionLineEnded(line, subscription, subscription.currentPeriodEnd);
    } catch (error) {
      logError(error);
    }
  }
};

const markLinesRemoved = (subscription: BillingSubscriptionEntity, lineIds: Set<string>, at: Date): BillingSubscriptionLine[] =>
  subscription.lines.map((line) => (lineIds.has(line.id) && line.status === 'active' ? { ...line, status: 'removed' as const, removedAt: at } : line));

// Stops billing one line now, with no proration or credit - the period already paid for is kept,
// and the source decides (via paidThrough) when access actually ends. The last remaining line
// cancels the whole subscription.
const removeLine = async (subscription: BillingSubscriptionEntity, lineId: string): Promise<BillingSubscriptionEntity> => {
  if (!isLive(subscription)) throw ConflictError('This subscription is no longer active');
  const line = activeLines(subscription).find((candidate) => candidate.id === lineId);
  if (!line) throw NotFoundError('Subscription line not found');

  const provider = getPaymentProvider();
  const isLastLine = activeLines(subscription).length === 1;
  if (isLastLine) {
    await provider.cancelSubscription(subscription.providerSubscriptionId);
  } else {
    await provider.removeSubscriptionItem(subscription.providerSubscriptionId, line.providerItemId);
  }

  const now = new Date();
  const updated =
    (await getBillingSubscriptionRepository().update(subscription.id, {
      lines: markLinesRemoved(subscription, new Set([lineId]), now),
      ...(isLastLine ? { status: 'canceled' as const, canceledAt: now } : {}),
    })) ?? subscription;
  await notifyLinesEnded(updated, [line]);
  return updated;
};

export const listUserSubscriptions = (userId: string): Promise<BillingSubscriptionEntity[]> =>
  getBillingSubscriptionRepository().findByUserId(userId);

export const cancelSubscriptionLine = async (userId: string, subscriptionId: string, lineId: string): Promise<BillingSubscriptionEntity> => {
  const subscription = await getBillingSubscriptionRepository().findById(subscriptionId);
  if (!subscription || subscription.userId !== userId) throw NotFoundError('Subscription not found');
  return removeLine(subscription, lineId);
};

export interface CancelSourceLinesInput {
  userId: string;
  sourceType: string;
  sourceId: string;
  // Narrows to lines whose options contain every one of these pairs - e.g. { childId } so dropping
  // one child from a class leaves a sibling's enrollment billing.
  matchOptions?: LineOptions;
}

const optionsMatch = (options: LineOptions, match: LineOptions | undefined): boolean =>
  !match || Object.entries(match).every(([key, value]) => options[key] === value);

// The hook a workspace's own "drop" flow calls (e.g. a client's drop-class route) to stop billing
// for that item. Returns how many subscription lines were stopped.
export const cancelSubscriptionLinesForSource = async (input: CancelSourceLinesInput): Promise<number> => {
  const repository = getBillingSubscriptionRepository();
  const subscriptions = await repository.findLiveByUserAndSource(input.userId, input.sourceType, input.sourceId);

  let removed = 0;
  for (const subscription of subscriptions) {
    const lineIds = activeLines(subscription)
      .filter((line) => line.sourceType === input.sourceType && line.sourceId === input.sourceId && optionsMatch(line.options, input.matchOptions))
      .map((line) => line.id);
    for (const lineId of lineIds) {
      // Re-read before each removal: removing a line changes which one is the subscription's last.
      const current = await repository.findById(subscription.id);
      if (!current || !isLive(current)) break;
      await removeLine(current, lineId);
      removed += 1;
    }
  }
  return removed;
};

export const cancelSubscriptionByAdmin = async (subscriptionId: string): Promise<BillingSubscriptionEntity> => {
  const subscription = await getBillingSubscriptionRepository().findById(subscriptionId);
  if (!subscription) throw NotFoundError('Subscription not found');
  if (!isLive(subscription)) throw ConflictError('This subscription is no longer active');

  await getPaymentProvider().cancelSubscription(subscription.providerSubscriptionId);
  const ending = activeLines(subscription);
  const now = new Date();
  const updated =
    (await getBillingSubscriptionRepository().update(subscription.id, {
      status: 'canceled',
      canceledAt: now,
      lines: markLinesRemoved(subscription, new Set(ending.map((line) => line.id)), now),
    })) ?? subscription;
  await notifyLinesEnded(updated, ending);
  return updated;
};

type InvoicePaidEvent = Extract<PaymentWebhookEvent, { kind: 'subscription.invoice_paid' }>;

// Invoice-level discount and tax aren't broken down per line by every provider, so renewal order
// lines carry list amounts and the invoice's real figures live on the order totals.
const createRenewalOrder = async (subscription: BillingSubscriptionEntity, event: InvoicePaidEvent): Promise<OrderEntity> =>
  getOrderRepository().create({
    userId: subscription.userId,
    kind: 'renewal',
    status: 'paid',
    currency: subscription.currency,
    lines: activeLines(subscription).map((line) => ({
      id: randomUUID(),
      sourceType: line.sourceType,
      sourceId: line.sourceId,
      ...(line.variantId ? { variantId: line.variantId } : {}),
      options: line.options,
      name: line.name,
      categories: [],
      requiresShipping: false,
      unitAmountCents: line.unitAmountCents,
      quantity: line.quantity,
      subtotalCents: line.unitAmountCents * line.quantity,
      discountCents: 0,
      taxCents: 0,
      totalCents: line.unitAmountCents * line.quantity,
      billing: {
        type: 'recurring',
        interval: subscription.interval,
        intervalCount: subscription.intervalCount,
        recurringUnitAmountCents: line.unitAmountCents,
        recurringDiscountCents: 0,
        // The period this renewal paid for starts when it was charged.
        firstBillingAt: event.paidAt,
        ...(subscription.endsAt ? { endsAt: subscription.endsAt } : {}),
      },
      reserved: false,
    })),
    totals: {
      subtotalCents: event.subtotalCents,
      discountCents: event.discountCents,
      shippingCents: 0,
      taxCents: event.taxCents,
      totalCents: event.totalCents,
    },
    payment: { provider: subscription.provider, invoiceId: event.invoiceId },
    subscriptionIds: [subscription.id],
    fulfillmentErrors: [],
    statusHistory: [{ status: 'paid', at: event.paidAt }],
    paidAt: event.paidAt,
  });

const handleRenewalPaid = async (event: InvoicePaidEvent): Promise<void> => {
  if (!event.isRenewal) return;
  const subscription = await getBillingSubscriptionRepository().findByProviderSubscriptionId(event.providerSubscriptionId);
  if (!subscription) return;
  if (await getOrderRepository().findByInvoiceId(event.invoiceId)) return;

  const order = await createRenewalOrder(subscription, event);
  if (subscription.status === 'past_due') {
    await getBillingSubscriptionRepository().update(subscription.id, { status: 'active' });
  }

  const errors: string[] = [];
  for (const line of activeLines(subscription)) {
    const source = findPurchasableSource(line.sourceType);
    if (!source?.onRenewalPaid) continue;
    try {
      await source.onRenewalPaid(line, subscription, order);
    } catch (error) {
      logError(error);
      errors.push(`Renewal fulfillment for "${line.name}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (errors.length > 0) await getOrderRepository().update(order.id, { fulfillmentErrors: errors });
};

const handleSubscriptionEnded = async (providerSubscriptionId: string): Promise<void> => {
  const repository = getBillingSubscriptionRepository();
  const subscription = await repository.findByProviderSubscriptionId(providerSubscriptionId);
  if (!subscription || !isLive(subscription)) return;

  const now = new Date();
  // Ran its scheduled course vs stopped early (e.g. renewals kept failing).
  const ranToEnd = subscription.endsAt !== undefined && subscription.endsAt.getTime() <= now.getTime() + 60_000;
  const ending = activeLines(subscription);
  const updated =
    (await repository.update(subscription.id, {
      status: ranToEnd ? 'ended' : 'canceled',
      canceledAt: now,
      lines: markLinesRemoved(subscription, new Set(ending.map((line) => line.id)), now),
    })) ?? subscription;
  await notifyLinesEnded(updated, ending);
};

export const handleSubscriptionWebhookEvent = async (event: PaymentWebhookEvent): Promise<void> => {
  const repository = getBillingSubscriptionRepository();
  switch (event.kind) {
    case 'subscription.invoice_paid':
      await handleRenewalPaid(event);
      return;
    case 'subscription.invoice_failed': {
      const subscription = await repository.findByProviderSubscriptionId(event.providerSubscriptionId);
      if (subscription && isLive(subscription)) await repository.update(subscription.id, { status: 'past_due' });
      return;
    }
    case 'subscription.updated': {
      const subscription = await repository.findByProviderSubscriptionId(event.providerSubscriptionId);
      if (!subscription || !isLive(subscription)) return;
      if (event.status === 'canceled') {
        await handleSubscriptionEnded(event.providerSubscriptionId);
        return;
      }
      await repository.update(subscription.id, {
        status: event.status,
        ...(event.currentPeriodEnd ? { currentPeriodEnd: event.currentPeriodEnd } : {}),
      });
      return;
    }
    case 'subscription.deleted':
      await handleSubscriptionEnded(event.providerSubscriptionId);
      return;
    default:
      return;
  }
};
