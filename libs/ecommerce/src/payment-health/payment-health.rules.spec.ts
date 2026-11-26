import { describe, expect, it } from 'vitest';
import type { PaymentEventEntity } from '@inithium/db';
import type { PaymentProviderHealth } from '@inithium/payments';
import { assessPaymentHealth, worstLevel } from './payment-health.rules';
import type { PaymentHealthCheck, PaymentHealthFacts } from './payment-health.rules';

const NOW = new Date(Date.UTC(2026, 10, 25, 12));
const hoursAgo = (hours: number): Date => new Date(NOW.getTime() - hours * 60 * 60_000);

const healthyProvider: PaymentProviderHealth = {
  provider: 'stripe',
  secretKey: { configured: true, valid: true, mode: 'live' },
  publishableKey: { configured: true, mode: 'live' },
  webhookSecretConfigured: true,
  webhookEndpoints: [{ url: 'https://api.example.com/api/payments/webhook', enabled: true, missingEvents: [] }],
};

const event = (overrides: Partial<PaymentEventEntity>): PaymentEventEntity => ({
  id: 'e1',
  provider: 'stripe',
  eventId: 'evt_1',
  type: 'payment_intent.succeeded',
  status: 'processed',
  createdAt: hoursAgo(1),
  updatedAt: hoursAgo(1),
  ...overrides,
});

const facts = (overrides: Partial<PaymentHealthFacts> = {}): PaymentHealthFacts => ({
  provider: healthyProvider,
  webhookPath: '/api/payments/webhook',
  isProduction: true,
  lastVerifiedEvent: event({}),
  rejectedRecord: null,
  failedEventsRecent: 0,
  stuckOrderCount: 0,
  failedOrdersRecent: 0,
  pastDueCount: 0,
  ...overrides,
});

const levelOf = (checks: PaymentHealthCheck[], id: string) => checks.find((check) => check.id === id)?.level;
const assess = (overrides: Partial<PaymentHealthFacts> = {}) => assessPaymentHealth(facts(overrides), NOW);

describe('assessPaymentHealth', () => {
  it('is green when keys, webhook and recent activity are fine', () => {
    expect(worstLevel(assess())).toBe('ok');
  });

  it('is red when the Stripe secret key is invalid', () => {
    const checks = assess({
      provider: { ...healthyProvider, secretKey: { configured: true, valid: false, error: 'rejected' }, webhookEndpoints: null },
    });
    expect(levelOf(checks, 'secret-key')).toBe('critical');
    expect(worstLevel(checks)).toBe('critical');
    // The endpoint list can't be fetched without a key; that's not reported a second time.
    expect(levelOf(checks, 'webhook-endpoint')).toBeUndefined();
  });

  it('is red when no webhook arrived in over 24h while orders are pending', () => {
    const checks = assess({ lastVerifiedEvent: event({ createdAt: hoursAgo(30) }), stuckOrderCount: 2 });
    expect(levelOf(checks, 'stuck-orders')).toBe('critical');
  });

  it('is red when orders are pending and no webhook was ever received', () => {
    expect(levelOf(assess({ lastVerifiedEvent: null, stuckOrderCount: 1 }), 'stuck-orders')).toBe('critical');
  });

  it('is only amber for pending orders while webhooks are arriving', () => {
    expect(levelOf(assess({ stuckOrderCount: 1 }), 'stuck-orders')).toBe('warning');
  });

  it('stays green on a quiet day with no webhook and nothing pending', () => {
    expect(worstLevel(assess({ lastVerifiedEvent: event({ createdAt: hoursAgo(72) }) }))).toBe('ok');
  });

  it('is red when the newest delivery was rejected for its signature', () => {
    const checks = assess({ rejectedRecord: event({ status: 'rejected', type: 'invalid_signature', updatedAt: hoursAgo(0.5) }) });
    expect(levelOf(checks, 'webhook-rejected')).toBe('critical');
  });

  it('ignores a rejected delivery older than the last good one', () => {
    const checks = assess({ rejectedRecord: event({ status: 'rejected', updatedAt: hoursAgo(5) }) });
    expect(levelOf(checks, 'webhook-rejected')).toBeUndefined();
  });

  it('is red when the webhook secret is missing or the keys are from different modes', () => {
    expect(levelOf(assess({ provider: { ...healthyProvider, webhookSecretConfigured: false } }), 'webhook-secret')).toBe('critical');
    expect(levelOf(assess({ provider: { ...healthyProvider, publishableKey: { configured: true, mode: 'test' } } }), 'publishable-key')).toBe(
      'critical',
    );
  });

  it('treats a missing endpoint as red in live mode but amber in test mode', () => {
    expect(levelOf(assess({ provider: { ...healthyProvider, webhookEndpoints: [] } }), 'webhook-endpoint')).toBe('critical');
    const testProvider: PaymentProviderHealth = {
      ...healthyProvider,
      secretKey: { configured: true, valid: true, mode: 'test' },
      publishableKey: { configured: true, mode: 'test' },
      webhookEndpoints: [],
    };
    expect(levelOf(assess({ provider: testProvider, isProduction: false }), 'webhook-endpoint')).toBe('warning');
  });

  it('is red when the only endpoint is disabled or misses events', () => {
    const disabled = [{ url: 'https://x/api/payments/webhook', enabled: false, missingEvents: [] }];
    expect(levelOf(assess({ provider: { ...healthyProvider, webhookEndpoints: disabled } }), 'webhook-endpoint')).toBe('critical');
    const partial = [{ url: 'https://x/api/payments/webhook', enabled: true, missingEvents: ['invoice.paid'] }];
    expect(levelOf(assess({ provider: { ...healthyProvider, webhookEndpoints: partial } }), 'webhook-events')).toBe('critical');
  });

  it('is amber for past-due subscriptions and failed webhook processing, green for failed checkouts', () => {
    const checks = assess({ pastDueCount: 2, failedEventsRecent: 1, failedOrdersRecent: 4 });
    expect(levelOf(checks, 'past-due')).toBe('warning');
    expect(levelOf(checks, 'failed-events')).toBe('warning');
    expect(levelOf(checks, 'failed-orders')).toBe('ok');
    expect(worstLevel(checks)).toBe('warning');
  });

  it('warns when production runs on test keys', () => {
    const testKeys: PaymentProviderHealth = {
      ...healthyProvider,
      secretKey: { configured: true, valid: true, mode: 'test' },
      publishableKey: { configured: true, mode: 'test' },
    };
    expect(levelOf(assess({ provider: testKeys }), 'test-mode')).toBe('warning');
    expect(levelOf(assess({ provider: testKeys, isProduction: false }), 'test-mode')).toBeUndefined();
  });
});
