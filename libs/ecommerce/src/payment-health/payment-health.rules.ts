import type { BillingSubscriptionEntity, OrderEntity, PaymentEventEntity } from '@inithium/db';
import type { PaymentProviderHealth } from '@inithium/payments';

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
export const STUCK_ORDER_AGE_MS = HOUR_MS;
const WEBHOOK_SILENCE_MS = DAY_MS;
export const RECENT_WINDOW_MS = 7 * DAY_MS;
export const LIST_LIMIT = 20;

export type PaymentHealthLevel = 'ok' | 'warning' | 'critical';

export interface PaymentHealthCheck {
  id: string;
  level: PaymentHealthLevel;
  title: string;
  detail: string;
}

export interface PaymentHealthFacts {
  provider: PaymentProviderHealth;
  webhookPath: string;
  isProduction: boolean;
  lastVerifiedEvent: PaymentEventEntity | null;
  rejectedRecord: PaymentEventEntity | null;
  failedEventsRecent: number;
  stuckOrderCount: number;
  failedOrdersRecent: number;
  pastDueCount: number;
}

export interface PaymentHealthReport {
  status: PaymentHealthLevel;
  checkedAt: Date;
  checks: PaymentHealthCheck[];
  provider: PaymentProviderHealth;
  webhook: {
    path: string;
    lastReceivedAt?: Date;
    lastRejectedAt?: Date;
    rejectedCount?: number;
    failedLast7Days: number;
  };
  failedOrdersLast7Days: number;
  stuckOrders: { total: number; items: OrderEntity[] };
  pastDueSubscriptions: { total: number; items: BillingSubscriptionEntity[] };
}

const LEVEL_RANK: Record<PaymentHealthLevel, number> = { ok: 0, warning: 1, critical: 2 };

export const worstLevel = (checks: PaymentHealthCheck[]): PaymentHealthLevel =>
  checks.reduce<PaymentHealthLevel>((worst, check) => (LEVEL_RANK[check.level] > LEVEL_RANK[worst] ? check.level : worst), 'ok');

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

const keyChecks = ({ provider, isProduction }: PaymentHealthFacts): PaymentHealthCheck[] => {
  const { secretKey, publishableKey } = provider;
  const checks: PaymentHealthCheck[] = [];

  if (!secretKey.valid) {
    checks.push({
      id: 'secret-key',
      level: 'critical',
      title: 'The server cannot talk to Stripe',
      detail: `${secretKey.error ?? 'The secret key did not work.'} No card can be charged until STRIPE_SECRET_KEY is fixed.`,
    });
  } else {
    checks.push({ id: 'secret-key', level: 'ok', title: 'Stripe secret key works', detail: `Connected in ${secretKey.mode ?? 'unknown'} mode.` });
  }

  if (!publishableKey.configured) {
    checks.push({
      id: 'publishable-key',
      level: 'critical',
      title: 'Checkout cannot show the card form',
      detail: 'STRIPE_PUBLISHABLE_KEY is not set on the server.',
    });
  } else if (secretKey.mode && publishableKey.mode && secretKey.mode !== publishableKey.mode) {
    checks.push({
      id: 'publishable-key',
      level: 'critical',
      title: 'Stripe keys are from different modes',
      detail: `The publishable key is a ${publishableKey.mode} key but the secret key is a ${secretKey.mode} key. Every card payment will fail until both come from the same mode.`,
    });
  }

  if (isProduction && secretKey.valid && secretKey.mode === 'test') {
    checks.push({
      id: 'test-mode',
      level: 'warning',
      title: 'The live site is using Stripe test keys',
      detail: 'Test cards succeed and real cards are refused. No real money is being collected.',
    });
  }
  return checks;
};

const webhookConfigChecks = ({ provider, webhookPath }: PaymentHealthFacts): PaymentHealthCheck[] => {
  const checks: PaymentHealthCheck[] = [];
  if (!provider.webhookSecretConfigured) {
    checks.push({
      id: 'webhook-secret',
      level: 'critical',
      title: 'Webhook signing secret is missing',
      detail: 'STRIPE_WEBHOOK_SECRET is not set, so every message from Stripe is rejected and payments are not confirmed.',
    });
  }

  const endpoints = provider.webhookEndpoints;
  if (endpoints === null) {
    // A bad secret key is already reported as critical; this only adds noise in that case.
    if (provider.secretKey.valid) {
      checks.push({
        id: 'webhook-endpoint',
        level: 'warning',
        title: 'Could not check the webhook endpoint',
        detail: provider.webhookEndpointsError ?? 'Stripe did not return the endpoint list.',
      });
    }
    return checks;
  }

  const enabled = endpoints.filter((endpoint) => endpoint.enabled);
  if (enabled.length === 0) {
    const disabled = endpoints.length > 0;
    checks.push({
      id: 'webhook-endpoint',
      // A test-mode setup often forwards webhooks with the Stripe CLI instead of a registered endpoint.
      level: provider.secretKey.mode === 'test' && !disabled ? 'warning' : 'critical',
      title: disabled ? 'The Stripe webhook endpoint is disabled' : 'No Stripe webhook endpoint is set up',
      detail: disabled
        ? 'Stripe stopped sending events to this site (it disables an endpoint after days of failed deliveries). Re-enable it in the Stripe Dashboard.'
        : `Stripe has no endpoint pointing at ${webhookPath}, so payments and monthly renewals are never confirmed here.`,
    });
    return checks;
  }

  const missing = [...new Set(enabled.flatMap((endpoint) => endpoint.missingEvents))];
  if (missing.length > 0) {
    checks.push({
      id: 'webhook-events',
      level: 'critical',
      title: 'The webhook endpoint is missing events',
      detail: `Add these events to the endpoint in the Stripe Dashboard: ${missing.join(', ')}.`,
    });
  } else {
    checks.push({ id: 'webhook-endpoint', level: 'ok', title: 'Stripe webhook endpoint is set up', detail: enabled.map((endpoint) => endpoint.url).join(', ') });
  }
  return checks;
};

const webhookActivityChecks = (facts: PaymentHealthFacts, now: Date): PaymentHealthCheck[] => {
  const checks: PaymentHealthCheck[] = [];
  const lastReceivedAt = facts.lastVerifiedEvent?.createdAt;
  const rejectedAt = facts.rejectedRecord?.updatedAt;

  // A rejected delivery newer than the last good one means Stripe's current secret doesn't match ours.
  if (rejectedAt && now.getTime() - rejectedAt.getTime() < RECENT_WINDOW_MS && (!lastReceivedAt || rejectedAt > lastReceivedAt)) {
    checks.push({
      id: 'webhook-rejected',
      level: 'critical',
      title: 'Messages from Stripe are being rejected',
      detail: 'The newest webhook deliveries had a signature that did not match STRIPE_WEBHOOK_SECRET. The signing secret was probably rolled in Stripe without updating the server.',
    });
  }

  const silent = !lastReceivedAt || now.getTime() - lastReceivedAt.getTime() > WEBHOOK_SILENCE_MS;
  if (facts.stuckOrderCount > 0) {
    checks.push({
      id: 'stuck-orders',
      level: silent ? 'critical' : 'warning',
      title: `${plural(facts.stuckOrderCount, 'order')} waiting on payment for over an hour`,
      detail: silent
        ? 'No message from Stripe has arrived in over 24 hours while orders are waiting. The webhook is most likely broken.'
        : 'Check each order against its payment in the Stripe Dashboard.',
    });
  }

  if (facts.failedEventsRecent > 0) {
    checks.push({
      id: 'failed-events',
      level: 'warning',
      title: `${plural(facts.failedEventsRecent, 'Stripe message')} failed to process this week`,
      detail: 'Stripe retries automatically for up to 3 days. If one stays failed, resend it from the Stripe Dashboard or contact the developer.',
    });
  }
  return checks;
};

const billingChecks = (facts: PaymentHealthFacts): PaymentHealthCheck[] => {
  const checks: PaymentHealthCheck[] = [];
  if (facts.pastDueCount > 0) {
    checks.push({
      id: 'past-due',
      level: 'warning',
      title: `${plural(facts.pastDueCount, 'subscription')} past due`,
      detail: 'A monthly renewal was declined and Stripe is retrying. The family needs to update their card.',
    });
  }
  if (facts.failedOrdersRecent > 0) {
    checks.push({
      id: 'failed-orders',
      level: 'ok',
      title: `${plural(facts.failedOrdersRecent, 'checkout')} failed in the last 7 days`,
      detail: 'Usually declined cards or abandoned checkouts. A sudden jump can mean a Stripe problem.',
    });
  }
  return checks;
};

export const assessPaymentHealth = (facts: PaymentHealthFacts, now: Date): PaymentHealthCheck[] => [
  ...keyChecks(facts),
  ...webhookConfigChecks(facts),
  ...webhookActivityChecks(facts, now),
  ...billingChecks(facts),
];
