import type { BillingInterval, LineOptions } from '@inithium/db';
import type { PricedLine } from './pricing/pricing';

export type LineBillingView =
  | { type: 'one_time' }
  | {
      type: 'recurring';
      interval: BillingInterval;
      intervalCount: number;
      recurringUnitAmountCents: number;
      // Per-period discount on renewals while the promo code's duration lasts.
      recurringDiscountCents: number;
      firstBillingAt: Date;
      endsAt?: Date;
    };

export const toLineBillingView = (line: PricedLine): LineBillingView =>
  line.schedule && line.recurring
    ? {
        type: 'recurring',
        interval: line.schedule.interval,
        intervalCount: line.schedule.intervalCount,
        recurringUnitAmountCents: line.recurring.unitAmountCents,
        recurringDiscountCents: line.recurring.discountCents,
        firstBillingAt: line.schedule.firstBillingAt,
        ...(line.schedule.endsAt ? { endsAt: line.schedule.endsAt } : {}),
      }
    : { type: 'one_time' };

export interface DiscountView {
  code: string;
  applied: boolean;
  message?: string;
}

export interface CartViewLine {
  id: string;
  sourceType: string;
  sourceId: string;
  variantId?: string;
  options: LineOptions;
  quantity: number;
  available: boolean;
  unavailableReason?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  href?: string;
  maxQuantity?: number;
  unitAmountCents?: number;
  subtotalCents?: number;
  discountCents?: number;
  billing?: LineBillingView;
}

// The cart as the shopper sees it before checkout - shipping and tax need an address, so they only
// appear on a CheckoutQuote.
export interface CartView {
  currency: string;
  lines: CartViewLine[];
  discount: DiscountView | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  requiresShipping: boolean;
  hasUnavailableLines: boolean;
}

export interface QuoteLine {
  id: string;
  sourceType: string;
  sourceId: string;
  variantId?: string;
  options: LineOptions;
  name: string;
  imageUrl?: string;
  href?: string;
  quantity: number;
  unitAmountCents: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  billing: LineBillingView;
}

export interface RecurringChargeView {
  interval: BillingInterval;
  intervalCount: number;
  firstBillingAt: Date;
  endsAt?: Date;
  // Per-period amount after the promo code, before tax (renewal tax is calculated at billing time).
  amountCents: number;
  lineIds: string[];
}

export interface CheckoutQuote {
  currency: string;
  lines: QuoteLine[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  // Charged at checkout.
  totalCents: number;
  discount: DiscountView | null;
  shippingMethod: { id: string; name: string; amountCents: number } | null;
  requiresShipping: boolean;
  recurring: RecurringChargeView[];
}
