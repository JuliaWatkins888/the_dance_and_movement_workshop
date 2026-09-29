import type { PaymentProvider } from './contracts/payment-provider.contract';
import type { TaxProvider } from './contracts/tax-provider.contract';
import { stripePaymentProvider } from './providers/stripe/stripe-payment.provider';
import { stripeTaxProvider } from './providers/stripe/stripe-tax.provider';

// The one place a workspace swaps processors: add providers/<name>/ implementing the contracts
// and point these at it.
export const activePaymentProvider: PaymentProvider = stripePaymentProvider;
export const activeTaxProvider: TaxProvider = stripeTaxProvider;
