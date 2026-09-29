import type { ShippingMethodEntity } from '@inithium/db';
import type { CartDiscountState } from '../cart/cart-lines';
import { scheduleKey } from '../pricing/billing';
import type { PricedCart, PricedLine } from '../pricing/pricing';
import { toLineBillingView } from '../views';
import type { CheckoutQuote, RecurringChargeView } from '../views';

const lineNetCents = (line: PricedLine): number => line.subtotalCents - line.discountCents;

const summarizeRecurring = (lines: PricedLine[]): RecurringChargeView[] => {
  const groups = lines.reduce<Map<string, PricedLine[]>>((acc, line) => {
    if (!line.schedule) return acc;
    const key = scheduleKey(line.schedule);
    return acc.set(key, [...(acc.get(key) ?? []), line]);
  }, new Map());

  return [...groups.values()].map((group) => {
    const schedule = group[0].schedule!;
    return {
      interval: schedule.interval,
      intervalCount: schedule.intervalCount,
      firstBillingAt: schedule.firstBillingAt,
      ...(schedule.endsAt ? { endsAt: schedule.endsAt } : {}),
      amountCents: group.reduce((sum, line) => sum + (line.recurring ? line.recurring.subtotalCents - line.recurring.discountCents : 0), 0),
      lineIds: group.map((line) => line.lineId),
    };
  });
};

export interface QuoteViewInput {
  currency: string;
  priced: PricedCart;
  taxByLineId: Map<string, number>;
  taxTotalCents: number;
  discountState: CartDiscountState | null;
  shippingMethod: ShippingMethodEntity | null;
}

// The priced summary a shopper (checkout) or staff member (a manual order) reviews before the
// order is placed.
export const buildQuoteView = ({ currency, priced, taxByLineId, taxTotalCents, discountState, shippingMethod }: QuoteViewInput): CheckoutQuote => ({
  currency,
  lines: priced.lines.map((line) => {
    const taxCents = taxByLineId.get(line.lineId) ?? 0;
    return {
      id: line.lineId,
      sourceType: line.ref.sourceType,
      sourceId: line.ref.sourceId,
      ...(line.ref.variantId ? { variantId: line.ref.variantId } : {}),
      options: line.ref.options,
      name: line.resolved.name,
      ...(line.resolved.imageUrl ? { imageUrl: line.resolved.imageUrl } : {}),
      ...(line.resolved.href ? { href: line.resolved.href } : {}),
      quantity: line.ref.quantity,
      unitAmountCents: line.unitAmountCents,
      subtotalCents: line.subtotalCents,
      discountCents: line.discountCents,
      taxCents,
      totalCents: lineNetCents(line) + taxCents,
      billing: toLineBillingView(line),
    };
  }),
  subtotalCents: priced.subtotalCents,
  discountCents: priced.discountCents,
  shippingCents: priced.shippingCents,
  taxCents: taxTotalCents,
  totalCents: priced.subtotalCents - priced.discountCents + priced.shippingCents + taxTotalCents,
  discount: discountState
    ? { code: discountState.code, applied: discountState.applied, ...(discountState.message ? { message: discountState.message } : {}) }
    : null,
  shippingMethod: shippingMethod ? { id: shippingMethod.id, name: shippingMethod.name, amountCents: priced.shippingCents } : null,
  requiresShipping: priced.requiresShipping,
  recurring: summarizeRecurring(priced.lines),
});
