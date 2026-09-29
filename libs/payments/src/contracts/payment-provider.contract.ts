// Provider-agnostic payment contract. @inithium/ecommerce only ever talks to this interface, so
// swapping Stripe for another processor means adding a providers/<name>/ implementation and
// pointing active-provider.ts at it - no cart, checkout, or route code changes.

export interface PaymentAddress {
  name?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export type PaymentInterval = 'day' | 'week' | 'month' | 'year';

export interface EnsureCustomerInput {
  // When set, the existing customer is updated (email/name/address) instead of creating another.
  existingCustomerId?: string;
  userId: string;
  email: string;
  name?: string;
  address?: PaymentAddress;
}

export interface ChargeInput {
  customerId: string;
  amountCents: number;
  currency: string;
  // Opaque token produced by the provider's frontend element (for Stripe, a ConfirmationToken id)
  // - the server never sees raw card data.
  paymentToken: string;
  // Keep the payment method on file for off-session renewals (true whenever the order starts a
  // subscription).
  savePaymentMethod: boolean;
  description?: string;
  metadata: Record<string, string>;
  idempotencyKey: string;
}

// succeeded       - money captured
// processing      - accepted but settling asynchronously; the payment webhook finishes the order
// requires_action - the customer must complete a step (e.g. 3-D Secure) using clientSecret
// failed          - declined or abandoned
export type PaymentStatus = 'succeeded' | 'processing' | 'requires_action' | 'failed';

export interface PaymentResult {
  paymentId: string;
  status: PaymentStatus;
  paymentMethodId?: string;
  clientSecret?: string;
  failureReason?: string;
}

export interface SubscriptionCoupon {
  kind: 'percent' | 'fixed';
  // percent: 1-100; fixed: cents off this item's line each billing period
  value: number;
  duration: 'repeating' | 'forever';
  durationInMonths?: number;
}

export interface CreateSubscriptionItemInput {
  // Caller-chosen id echoed back on the created item so the caller can map items to its own lines.
  reference: string;
  name: string;
  unitAmountCents: number;
  quantity: number;
  taxCode?: string;
  coupon?: SubscriptionCoupon;
}

export interface CreateSubscriptionInput {
  customerId: string;
  paymentMethodId: string;
  currency: string;
  interval: PaymentInterval;
  intervalCount: number;
  // The first period is always paid by the checkout charge, so the subscription's first automatic
  // charge happens here - never at creation.
  firstBillingAt: Date;
  // No renewal is charged at or after this instant.
  endsAt?: Date;
  items: CreateSubscriptionItemInput[];
  metadata: Record<string, string>;
  idempotencyKey: string;
}

export type ProviderSubscriptionStatus = 'active' | 'past_due' | 'canceled';

export interface CreatedSubscription {
  providerSubscriptionId: string;
  status: ProviderSubscriptionStatus;
  currentPeriodEnd?: Date;
  items: { reference: string; providerItemId: string }[];
}

interface WebhookEventBase {
  eventId: string;
  eventType: string;
}

// Provider events normalized to the handful of facts ecommerce acts on; anything else is 'ignored'.
export type PaymentWebhookEvent =
  | (WebhookEventBase & { kind: 'payment.succeeded'; paymentId: string; orderId?: string })
  | (WebhookEventBase & { kind: 'payment.failed'; paymentId: string; orderId?: string; reason?: string })
  | (WebhookEventBase & {
      kind: 'subscription.invoice_paid';
      providerSubscriptionId: string;
      invoiceId: string;
      // Only a scheduled period renewal - not the creation invoice or a mid-cycle adjustment.
      isRenewal: boolean;
      subtotalCents: number;
      discountCents: number;
      taxCents: number;
      totalCents: number;
      paidAt: Date;
    })
  | (WebhookEventBase & { kind: 'subscription.invoice_failed'; providerSubscriptionId: string; invoiceId: string })
  | (WebhookEventBase & {
      kind: 'subscription.updated';
      providerSubscriptionId: string;
      status: ProviderSubscriptionStatus;
      currentPeriodEnd?: Date;
    })
  | (WebhookEventBase & { kind: 'subscription.deleted'; providerSubscriptionId: string })
  | (WebhookEventBase & { kind: 'ignored' });

// What the storefront needs to render the provider's own payment fields - public values only.
export interface PaymentClientConfig {
  provider: string;
  publishableKey: string;
}

export interface PaymentProvider {
  name: string;
  // Request header carrying the provider's webhook signature (lowercase).
  webhookSignatureHeader: string;
  // null when the provider isn't configured, so the catalog still works without payments set up.
  getClientConfig: () => PaymentClientConfig | null;
  ensureCustomer: (input: EnsureCustomerInput) => Promise<string>;
  charge: (input: ChargeInput) => Promise<PaymentResult>;
  retrievePayment: (paymentId: string) => Promise<PaymentResult>;
  // Voids an unfinished payment so it can no longer succeed. Returns the payment's final state -
  // 'succeeded' if it completed before the cancel landed, so the caller can finish the order.
  cancelPayment: (paymentId: string) => Promise<PaymentResult>;
  createSubscription: (input: CreateSubscriptionInput) => Promise<CreatedSubscription>;
  // Stops billing one item immediately with no proration or credit.
  removeSubscriptionItem: (providerSubscriptionId: string, providerItemId: string) => Promise<void>;
  // Stops the whole subscription immediately with no proration or credit.
  cancelSubscription: (providerSubscriptionId: string) => Promise<void>;
  // null when the signature doesn't verify - the caller must reject the request.
  parseWebhookEvent: (rawBody: Buffer, signature: string) => PaymentWebhookEvent | null;
}
