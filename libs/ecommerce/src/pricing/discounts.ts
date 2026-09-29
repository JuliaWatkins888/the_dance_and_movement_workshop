import type { DiscountEntity } from '@inithium/db';
import { lineRecurringSubtotalCents, lineTodaySubtotalCents } from './pricing';
import type { LineDiscount, PricingLine } from './pricing';

export interface DiscountContext {
  now: Date;
  // How many of this user's completed orders already used the code.
  userRedemptions: number;
}

export type DiscountEvaluation =
  | { ok: true; allocation: Map<string, LineDiscount> }
  | { ok: false; message: string };

const matchesBilling = (discount: DiscountEntity, line: PricingLine): boolean => {
  if (discount.appliesToBilling === 'all') return true;
  const isRecurring = line.schedule !== null;
  return discount.appliesToBilling === 'recurring' ? isRecurring : !isRecurring;
};

const matchesTarget = (discount: DiscountEntity, line: PricingLine): boolean => {
  const { sourceTypes, sourceIds, categories } = discount.target;
  if (sourceTypes.length > 0 && !sourceTypes.includes(line.ref.sourceType)) return false;
  if (sourceIds.length > 0 && !sourceIds.includes(line.ref.sourceId)) return false;
  if (categories.length > 0 && !line.resolved.categories.some((category) => categories.includes(category))) return false;
  return true;
};

export const isLineEligible = (discount: DiscountEntity, line: PricingLine): boolean =>
  matchesBilling(discount, line) && (discount.scope === 'order' || matchesTarget(discount, line));

// Splits `total` across `weights` in proportion, in whole cents, with the rounding remainder going
// to the largest fractional shares - so the parts always sum to exactly `total`.
export const allocateProportionally = (total: number, weights: number[]): number[] => {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0 || total <= 0) return weights.map(() => 0);
  const exact = weights.map((weight) => (total * weight) / weightSum);
  const floored = exact.map(Math.floor);
  const remainder = total - floored.reduce((sum, part) => sum + part, 0);
  const byFraction = exact.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction);
  const bumped = new Set(byFraction.slice(0, remainder).map((entry) => entry.index));
  return floored.map((part, index) => (bumped.has(index) ? part + 1 : part));
};

const percentOf = (amountCents: number, percent: number): number => Math.round((amountCents * percent) / 100);

const allocate = (discount: DiscountEntity, eligible: PricingLine[]): Map<string, LineDiscount> => {
  const carriesToRenewals = discount.duration !== 'once';

  if (discount.kind === 'percent') {
    return new Map(
      eligible.map((line) => [
        line.lineId,
        {
          todayCents: percentOf(lineTodaySubtotalCents(line), discount.value),
          recurringCents: carriesToRenewals ? percentOf(lineRecurringSubtotalCents(line), discount.value) : 0,
        },
      ]),
    );
  }

  if (discount.scope === 'items') {
    // Fixed item discount: `value` off each eligible unit, never below zero.
    return new Map(
      eligible.map((line) => [
        line.lineId,
        {
          todayCents: Math.min(discount.value * line.ref.quantity, lineTodaySubtotalCents(line)),
          recurringCents: carriesToRenewals ? Math.min(discount.value * line.ref.quantity, lineRecurringSubtotalCents(line)) : 0,
        },
      ]),
    );
  }

  // Fixed order discount: one `value` split across the eligible lines by their share of the charge.
  const subtotals = eligible.map(lineTodaySubtotalCents);
  const total = Math.min(discount.value, subtotals.reduce((sum, subtotal) => sum + subtotal, 0));
  const shares = allocateProportionally(total, subtotals);
  return new Map(
    eligible.map((line, index) => [
      line.lineId,
      {
        todayCents: shares[index],
        recurringCents: carriesToRenewals ? Math.min(shares[index], lineRecurringSubtotalCents(line)) : 0,
      },
    ]),
  );
};

export const evaluateDiscount = (discount: DiscountEntity, lines: PricingLine[], ctx: DiscountContext): DiscountEvaluation => {
  if (!discount.isActive) return { ok: false, message: 'This code is not active.' };
  if (discount.startsAt && discount.startsAt > ctx.now) return { ok: false, message: 'This code is not active yet.' };
  if (discount.endsAt && discount.endsAt < ctx.now) return { ok: false, message: 'This code has expired.' };
  if (discount.maxRedemptions !== undefined && discount.timesRedeemed >= discount.maxRedemptions) {
    return { ok: false, message: 'This code has reached its usage limit.' };
  }
  if (discount.maxRedemptionsPerUser !== undefined && ctx.userRedemptions >= discount.maxRedemptionsPerUser) {
    return { ok: false, message: 'You have already used this code the maximum number of times.' };
  }

  const eligible = lines.filter((line) => isLineEligible(discount, line));
  if (eligible.length === 0) return { ok: false, message: 'This code does not apply to any items in your cart.' };

  const cartSubtotal = lines.reduce((sum, line) => sum + lineTodaySubtotalCents(line), 0);
  if (discount.minSubtotalCents !== undefined && cartSubtotal < discount.minSubtotalCents) {
    return { ok: false, message: 'Your cart does not meet the minimum order amount for this code.' };
  }
  const eligibleQuantity = eligible.reduce((sum, line) => sum + line.ref.quantity, 0);
  if (discount.minQuantity !== undefined && eligibleQuantity < discount.minQuantity) {
    return { ok: false, message: `Add at least ${discount.minQuantity} eligible items to use this code.` };
  }

  return { ok: true, allocation: allocate(discount, eligible) };
};
