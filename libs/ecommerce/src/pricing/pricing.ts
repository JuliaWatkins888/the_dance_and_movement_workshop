import type { ShippingMethodEntity } from '@inithium/db';
import type { PurchasableLineRef, ResolvedPurchasable } from '../purchasables/purchasable.contract';
import type { LineSchedule } from './billing';

// A cart line after its source resolved it - the input to every pure pricing step below.
export interface PricingLine {
  lineId: string;
  ref: PurchasableLineRef;
  resolved: ResolvedPurchasable;
  // null: charged once at checkout, no subscription.
  schedule: LineSchedule | null;
}

export interface LineDiscount {
  // Off the checkout charge.
  todayCents: number;
  // Off each renewal while the code's duration lasts (0 for 'once' codes and one-time lines).
  recurringCents: number;
}

export interface PricedLine extends PricingLine {
  unitAmountCents: number;
  subtotalCents: number;
  discountCents: number;
  recurring?: {
    unitAmountCents: number;
    subtotalCents: number;
    discountCents: number;
  };
}

export interface PricedCart {
  lines: PricedLine[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  requiresShipping: boolean;
  hasRecurring: boolean;
}

export const lineTodayUnitCents = (line: PricingLine): number =>
  line.resolved.billing.type === 'recurring' && line.resolved.billing.initialAmountCents !== undefined
    ? line.resolved.billing.initialAmountCents
    : line.resolved.unitAmountCents;

export const lineTodaySubtotalCents = (line: PricingLine): number => lineTodayUnitCents(line) * line.ref.quantity;

export const lineRecurringSubtotalCents = (line: PricingLine): number =>
  line.schedule ? line.resolved.unitAmountCents * line.ref.quantity : 0;

export const shippingCostCents = (method: ShippingMethodEntity | null, discountedSubtotalCents: number): number => {
  if (!method) return 0;
  if (method.freeOverCents !== undefined && discountedSubtotalCents >= method.freeOverCents) return 0;
  return method.amountCents;
};

export const priceCart = (
  lines: PricingLine[],
  discounts: Map<string, LineDiscount>,
  shippingMethod: ShippingMethodEntity | null,
): PricedCart => {
  const priced = lines.map((line): PricedLine => {
    const discount = discounts.get(line.lineId) ?? { todayCents: 0, recurringCents: 0 };
    return {
      ...line,
      unitAmountCents: lineTodayUnitCents(line),
      subtotalCents: lineTodaySubtotalCents(line),
      discountCents: discount.todayCents,
      ...(line.schedule
        ? {
            recurring: {
              unitAmountCents: line.resolved.unitAmountCents,
              subtotalCents: lineRecurringSubtotalCents(line),
              discountCents: discount.recurringCents,
            },
          }
        : {}),
    };
  });

  const subtotalCents = priced.reduce((sum, line) => sum + line.subtotalCents, 0);
  const discountCents = priced.reduce((sum, line) => sum + line.discountCents, 0);
  const requiresShipping = priced.some((line) => line.resolved.requiresShipping);

  return {
    lines: priced,
    subtotalCents,
    discountCents,
    shippingCents: requiresShipping ? shippingCostCents(shippingMethod, subtotalCents - discountCents) : 0,
    requiresShipping,
    hasRecurring: priced.some((line) => line.schedule !== null),
  };
};
