import type { PostalAddressInput } from '@inithium/api-client';

export interface PaymentBillingDetails {
  name?: string;
  email?: string;
  address: PostalAddressInput;
}

// What the checkout page needs from any payment provider's fields, so the page itself never
// touches a provider SDK. A new provider adds a component implementing this and a case in
// PaymentFields.tsx - mirroring libs/payments' PaymentProvider on the API side.
export interface PaymentFieldsHandle {
  // Validates what the shopper entered and turns it into the opaque paymentToken the API's
  // POST /api/checkout expects. Rejects with a shopper-readable Error.
  createPaymentToken: (billing: PaymentBillingDetails) => Promise<string>;
  // Runs the provider's extra verification step (e.g. a 3-D Secure pop-up) for an order the API
  // answered with requires_action. Rejects with a shopper-readable Error if it isn't completed.
  handleNextAction: (clientSecret: string) => Promise<void>;
}

export interface PaymentFieldsProps {
  readonly publishableKey: string;
  // The amount the fields will be charged for, in minor units - shown by some wallets (Apple/Google
  // Pay) and required up front by deferred-intent payment forms.
  readonly amountCents: number;
  readonly currency: string;
  // Keep the payment method on file for renewals (the cart has a recurring line).
  readonly saveForFutureUse: boolean;
}
