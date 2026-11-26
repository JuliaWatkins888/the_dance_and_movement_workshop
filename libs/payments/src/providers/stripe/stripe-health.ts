import type Stripe from 'stripe';
import type { PaymentKeyMode, PaymentProviderHealth, PaymentWebhookEndpointHealth } from '../../contracts/payment-provider.contract';
import { getStripe } from './stripe.client';

// The Stripe event types normalizeEvent (stripe-payment.provider.ts) acts on. Keep the two in step:
// an endpoint missing one of these silently drops that part of the payment flow.
export const HANDLED_STRIPE_EVENTS = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
] as const;

const envValue = (key: string): string | undefined => process.env[key]?.trim() || undefined;

const keyMode = (key: string | undefined): PaymentKeyMode | undefined => {
  if (!key) return undefined;
  if (/^(sk|rk|pk)_live_/.test(key)) return 'live';
  if (/^(sk|rk|pk)_test_/.test(key)) return 'test';
  return undefined;
};

const describeStripeError = (error: unknown): string => {
  const { type, message } = error as { type?: string; message?: string };
  switch (type) {
    case 'StripeAuthenticationError':
      return 'Stripe rejected the secret key (wrong, rolled, or deleted).';
    case 'StripePermissionError':
      return 'The key is valid but not allowed to make this call (a restricted key missing a permission).';
    case 'StripeConnectionError':
      return 'Could not reach Stripe from the server.';
    default:
      return message ?? 'Unknown Stripe error.';
  }
};

const toEndpointHealth = (endpoint: Stripe.WebhookEndpoint): PaymentWebhookEndpointHealth => {
  const subscribed = new Set(endpoint.enabled_events);
  return {
    url: endpoint.url,
    enabled: endpoint.status === 'enabled',
    missingEvents: subscribed.has('*') ? [] : HANDLED_STRIPE_EVENTS.filter((type) => !subscribed.has(type)),
  };
};

export const checkStripeHealth = async (webhookPath: string): Promise<PaymentProviderHealth> => {
  const secretKey = envValue('STRIPE_SECRET_KEY');
  const publishableKey = envValue('STRIPE_PUBLISHABLE_KEY');
  const base = {
    provider: 'stripe',
    publishableKey: { configured: Boolean(publishableKey), ...(keyMode(publishableKey) ? { mode: keyMode(publishableKey) } : {}) },
    webhookSecretConfigured: Boolean(envValue('STRIPE_WEBHOOK_SECRET')),
  };

  if (!secretKey) {
    return {
      ...base,
      secretKey: { configured: false, valid: false, error: 'STRIPE_SECRET_KEY is not set on the server.' },
      webhookEndpoints: null,
      webhookEndpointsError: 'Needs a working secret key.',
    };
  }

  const stripe = getStripe();
  let mode: PaymentKeyMode | undefined;
  try {
    const balance = await stripe.balance.retrieve();
    mode = balance.livemode ? 'live' : 'test';
  } catch (error) {
    return {
      ...base,
      secretKey: { configured: true, valid: false, error: describeStripeError(error), ...(keyMode(secretKey) ? { mode: keyMode(secretKey) } : {}) },
      webhookEndpoints: null,
      webhookEndpointsError: 'Needs a working secret key.',
    };
  }

  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    return {
      ...base,
      secretKey: { configured: true, valid: true, ...(mode ? { mode } : {}) },
      webhookEndpoints: endpoints.data
        .filter((endpoint) => new URL(endpoint.url).pathname.replace(/\/$/, '') === webhookPath)
        .map(toEndpointHealth),
    };
  } catch (error) {
    return {
      ...base,
      secretKey: { configured: true, valid: true, ...(mode ? { mode } : {}) },
      webhookEndpoints: null,
      webhookEndpointsError: describeStripeError(error),
    };
  }
};
