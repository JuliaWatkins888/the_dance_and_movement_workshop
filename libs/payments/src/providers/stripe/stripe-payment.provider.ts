import type Stripe from 'stripe';
import type {
  ChargeInput,
  CreatedSubscription,
  CreateSubscriptionInput,
  CreateSubscriptionItemInput,
  EnsureCustomerInput,
  PaymentAddress,
  PaymentClientConfig,
  PaymentProvider,
  PaymentResult,
  PaymentWebhookEvent,
  ProviderSubscriptionStatus,
} from '../../contracts/payment-provider.contract';
import {
  fromUnixSeconds,
  getStripe,
  getStripePublishableKey,
  getStripeWebhookSecret,
  isStripeTaxEnabled,
  toUnixSeconds,
} from './stripe.client';

const toStripeAddress = (address: PaymentAddress): Stripe.AddressParam => ({
  line1: address.line1,
  line2: address.line2 ?? '',
  city: address.city,
  state: address.state ?? '',
  postal_code: address.postalCode,
  country: address.country,
});

const idOf = (value: string | { id: string } | null | undefined): string | undefined =>
  typeof value === 'string' ? value : value?.id;

const toPaymentResult = (intent: Stripe.PaymentIntent): PaymentResult => {
  const base = { paymentId: intent.id, paymentMethodId: idOf(intent.payment_method) };
  switch (intent.status) {
    case 'succeeded':
      return { ...base, status: 'succeeded' };
    case 'requires_action':
      return { ...base, status: 'requires_action', clientSecret: intent.client_secret ?? undefined };
    case 'requires_payment_method':
    case 'canceled':
      return { ...base, status: 'failed', failureReason: intent.last_payment_error?.message ?? 'Payment was not completed' };
    default:
      return { ...base, status: 'processing' };
  }
};

// Stripe reports a trialing subscription as its own status; ecommerce's first period is always
// prepaid at checkout (modeled as a trial until firstBillingAt), so that's simply "active" here.
const mapSubscriptionStatus = (status: Stripe.Subscription.Status): ProviderSubscriptionStatus => {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'past_due';
  }
};

// Since the 2025 "basil" API, billing periods live on subscription items rather than on the
// subscription itself; during the prepaid first period the trial end is the next charge date.
const currentPeriodEndOf = (subscription: Stripe.Subscription): Date | undefined => {
  if (subscription.status === 'trialing' && subscription.trial_end) {
    return fromUnixSeconds(subscription.trial_end);
  }
  const ends = subscription.items.data.map((item) => item.current_period_end).filter((end) => end > 0);
  return ends.length > 0 ? fromUnixSeconds(Math.min(...ends)) : undefined;
};

const subscriptionIdOfInvoice = (invoice: Stripe.Invoice): string | undefined =>
  idOf(invoice.parent?.subscription_details?.subscription);

const sumAmounts = (entries: { amount: number }[] | null | undefined): number =>
  (entries ?? []).reduce((total, entry) => total + entry.amount, 0);

const buildSubscriptionItem = async (
  stripe: Stripe,
  input: CreateSubscriptionInput,
  item: CreateSubscriptionItemInput,
): Promise<Stripe.SubscriptionCreateParams.Item> => {
  // Subscription price_data can't create a product inline, so each purchased line gets a
  // lightweight Stripe product carrying its display name and tax code.
  const product = await stripe.products.create(
    { name: item.name, ...(item.taxCode ? { tax_code: item.taxCode } : {}), metadata: { reference: item.reference } },
    { idempotencyKey: `${input.idempotencyKey}-product-${item.reference}` },
  );

  const coupon = item.coupon
    ? await stripe.coupons.create(
        {
          ...(item.coupon.kind === 'percent'
            ? { percent_off: item.coupon.value }
            : { amount_off: item.coupon.value, currency: input.currency }),
          duration: item.coupon.duration,
          ...(item.coupon.duration === 'repeating' ? { duration_in_months: item.coupon.durationInMonths ?? 1 } : {}),
          max_redemptions: 1,
        },
        { idempotencyKey: `${input.idempotencyKey}-coupon-${item.reference}` },
      )
    : null;

  return {
    price_data: {
      currency: input.currency,
      product: product.id,
      recurring: { interval: input.interval, interval_count: input.intervalCount },
      unit_amount: item.unitAmountCents,
      tax_behavior: 'exclusive',
    },
    quantity: item.quantity,
    metadata: { reference: item.reference },
    ...(coupon ? { discounts: [{ coupon: coupon.id }] } : {}),
  };
};

const normalizeEvent = (event: Stripe.Event): PaymentWebhookEvent => {
  const base = { eventId: event.id, eventType: event.type };

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object;
      return { ...base, kind: 'payment.succeeded', paymentId: intent.id, orderId: intent.metadata?.['orderId'] };
    }
    case 'payment_intent.payment_failed': {
      const intent = event.data.object;
      return {
        ...base,
        kind: 'payment.failed',
        paymentId: intent.id,
        orderId: intent.metadata?.['orderId'],
        reason: intent.last_payment_error?.message,
      };
    }
    case 'invoice.paid': {
      const invoice = event.data.object;
      const providerSubscriptionId = subscriptionIdOfInvoice(invoice);
      if (!providerSubscriptionId || !invoice.id) return { ...base, kind: 'ignored' };
      return {
        ...base,
        kind: 'subscription.invoice_paid',
        providerSubscriptionId,
        invoiceId: invoice.id,
        isRenewal: invoice.billing_reason === 'subscription_cycle',
        subtotalCents: invoice.subtotal,
        discountCents: sumAmounts(invoice.total_discount_amounts),
        taxCents: sumAmounts(invoice.total_taxes),
        totalCents: invoice.amount_paid,
        paidAt: fromUnixSeconds(event.created),
      };
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const providerSubscriptionId = subscriptionIdOfInvoice(invoice);
      if (!providerSubscriptionId || !invoice.id) return { ...base, kind: 'ignored' };
      return { ...base, kind: 'subscription.invoice_failed', providerSubscriptionId, invoiceId: invoice.id };
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      return {
        ...base,
        kind: 'subscription.updated',
        providerSubscriptionId: subscription.id,
        status: mapSubscriptionStatus(subscription.status),
        currentPeriodEnd: currentPeriodEndOf(subscription),
      };
    }
    case 'customer.subscription.deleted':
      return { ...base, kind: 'subscription.deleted', providerSubscriptionId: event.data.object.id };
    default:
      return { ...base, kind: 'ignored' };
  }
};

export const stripePaymentProvider: PaymentProvider = {
  name: 'stripe',
  webhookSignatureHeader: 'stripe-signature',

  getClientConfig: (): PaymentClientConfig | null => {
    const publishableKey = getStripePublishableKey();
    return publishableKey ? { provider: 'stripe', publishableKey } : null;
  },

  ensureCustomer: async ({ existingCustomerId, userId, email, name, address }: EnsureCustomerInput): Promise<string> => {
    const stripe = getStripe();
    const details = {
      email,
      ...(name ? { name } : {}),
      ...(address ? { address: toStripeAddress(address) } : {}),
      metadata: { userId },
    };
    if (existingCustomerId) {
      await stripe.customers.update(existingCustomerId, details);
      return existingCustomerId;
    }
    const customer = await stripe.customers.create(details);
    return customer.id;
  },

  charge: async (input: ChargeInput): Promise<PaymentResult> => {
    const stripe = getStripe();
    try {
      const intent = await stripe.paymentIntents.create(
        {
          amount: input.amountCents,
          currency: input.currency,
          customer: input.customerId,
          confirmation_token: input.paymentToken,
          confirm: true,
          // Redirect-based methods would need a return_url round trip the checkout flow doesn't
          // model yet; cards and wallets complete in-page (3-D Secure via requires_action).
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
          ...(input.savePaymentMethod ? { setup_future_usage: 'off_session' as const } : {}),
          ...(input.description ? { description: input.description } : {}),
          metadata: input.metadata,
        },
        { idempotencyKey: input.idempotencyKey },
      );
      return toPaymentResult(intent);
    } catch (error) {
      // A decline surfaces as a thrown StripeCardError rather than a failed intent.
      const stripeError = error as { type?: string; message?: string; payment_intent?: { id: string } };
      if (stripeError.type === 'StripeCardError') {
        return {
          paymentId: stripeError.payment_intent?.id ?? '',
          status: 'failed',
          failureReason: stripeError.message ?? 'Your card was declined',
        };
      }
      throw error;
    }
  },

  retrievePayment: async (paymentId: string): Promise<PaymentResult> =>
    toPaymentResult(await getStripe().paymentIntents.retrieve(paymentId)),

  cancelPayment: async (paymentId: string): Promise<PaymentResult> => {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(paymentId);
    if (intent.status === 'succeeded' || intent.status === 'canceled' || intent.status === 'processing') {
      return toPaymentResult(intent);
    }
    return toPaymentResult(await stripe.paymentIntents.cancel(paymentId));
  },

  createSubscription: async (input: CreateSubscriptionInput): Promise<CreatedSubscription> => {
    const stripe = getStripe();
    const items = await Promise.all(input.items.map((item) => buildSubscriptionItem(stripe, input, item)));

    const subscription = await stripe.subscriptions.create(
      {
        customer: input.customerId,
        default_payment_method: input.paymentMethodId,
        currency: input.currency,
        items,
        trial_end: toUnixSeconds(input.firstBillingAt),
        ...(input.endsAt ? { cancel_at: toUnixSeconds(input.endsAt) } : {}),
        proration_behavior: 'none',
        automatic_tax: { enabled: isStripeTaxEnabled() },
        off_session: true,
        metadata: input.metadata,
      },
      { idempotencyKey: input.idempotencyKey },
    );

    return {
      providerSubscriptionId: subscription.id,
      status: mapSubscriptionStatus(subscription.status),
      currentPeriodEnd: currentPeriodEndOf(subscription),
      items: subscription.items.data.map((item) => ({ reference: item.metadata['reference'] ?? '', providerItemId: item.id })),
    };
  },

  removeSubscriptionItem: async (_providerSubscriptionId: string, providerItemId: string): Promise<void> => {
    await getStripe().subscriptionItems.del(providerItemId, { proration_behavior: 'none' });
  },

  cancelSubscription: async (providerSubscriptionId: string): Promise<void> => {
    await getStripe().subscriptions.cancel(providerSubscriptionId, { prorate: false, invoice_now: false });
  },

  parseWebhookEvent: (rawBody: Buffer, signature: string): PaymentWebhookEvent | null => {
    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
    } catch {
      return null;
    }
    return normalizeEvent(event);
  },
};
