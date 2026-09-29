import { activePaymentProvider, activeTaxProvider } from './active-provider';

export const getPaymentProvider = () => activePaymentProvider;
export const getTaxProvider = () => activeTaxProvider;

export type {
  PaymentAddress,
  PaymentClientConfig,
  PaymentInterval,
  EnsureCustomerInput,
  ChargeInput,
  PaymentStatus,
  PaymentResult,
  SubscriptionCoupon,
  CreateSubscriptionItemInput,
  CreateSubscriptionInput,
  ProviderSubscriptionStatus,
  CreatedSubscription,
  PaymentWebhookEvent,
  PaymentProvider,
} from './contracts/payment-provider.contract';
export type { TaxLineInput, CalculateTaxInput, TaxCalculation, TaxProvider } from './contracts/tax-provider.contract';
