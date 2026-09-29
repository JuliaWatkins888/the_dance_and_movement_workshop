import type { PaymentAddress } from './payment-provider.contract';

export interface TaxLineInput {
  // Unique within one calculation; echoed back on the result line.
  reference: string;
  // Line total after discounts (unit price x quantity - discount), tax-exclusive.
  amountCents: number;
  quantity: number;
  taxCode?: string;
}

export interface CalculateTaxInput {
  currency: string;
  address: PaymentAddress;
  addressSource: 'shipping' | 'billing';
  lines: TaxLineInput[];
  shippingCents: number;
}

export interface TaxCalculation {
  // null when nothing taxable was sent (nothing to commit later).
  calculationId: string | null;
  lines: { reference: string; taxCents: number }[];
  shippingTaxCents: number;
  totalTaxCents: number;
}

// Taxes the checkout charge. Recurring renewals are taxed by the payment provider itself at each
// billing (for Stripe, Stripe Tax's automatic_tax on the subscription).
export interface TaxProvider {
  name: string;
  calculate: (input: CalculateTaxInput) => Promise<TaxCalculation>;
  // Records the calculation as a completed sale for tax reporting, once payment has succeeded.
  commit: (calculationId: string, reference: string) => Promise<void>;
}
