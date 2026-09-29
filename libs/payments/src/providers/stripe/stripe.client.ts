import Stripe from 'stripe';
import { z } from 'zod';

const secretKeySchema = z.string().min(1, 'STRIPE_SECRET_KEY environment variable must be set');
const webhookSecretSchema = z.string().min(1, 'STRIPE_WEBHOOK_SECRET environment variable must be set');

let cachedClient: Stripe | undefined;

// Built lazily on first use rather than at import time, mirroring the storage plugin's S3 client -
// the API boots fine without Stripe configured, and only a payment call surfaces the missing key.
export const getStripe = (): Stripe => {
  if (!cachedClient) {
    cachedClient = new Stripe(secretKeySchema.parse(process.env['STRIPE_SECRET_KEY']));
  }
  return cachedClient;
};

export const getStripePublishableKey = (): string | null => process.env['STRIPE_PUBLISHABLE_KEY']?.trim() || null;

export const getStripeWebhookSecret = (): string => webhookSecretSchema.parse(process.env['STRIPE_WEBHOOK_SECRET']);

// On unless STRIPE_TAX_ENABLED=false. Off, no tax is calculated or collected anywhere (checkout
// or renewals), so a sandbox - or a store that doesn't collect sales tax - needs no Stripe Tax
// setup at all.
export const isStripeTaxEnabled = (): boolean => process.env['STRIPE_TAX_ENABLED']?.trim().toLowerCase() !== 'false';

// Stripe Tax's code for shipping charges, applied to the shipping line of every calculation.
export const STRIPE_SHIPPING_TAX_CODE = 'txcd_92010001';

export const toUnixSeconds = (date: Date): number => Math.floor(date.getTime() / 1000);

export const fromUnixSeconds = (seconds: number): Date => new Date(seconds * 1000);
