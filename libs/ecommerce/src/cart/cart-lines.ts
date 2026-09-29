import { getDiscountRepository, getOrderRepository } from '@inithium/db';
import type { CartLine, DiscountEntity } from '@inithium/db';
import { findPurchasableSource } from '../purchasables/registry';
import type { PurchasableContext, PurchasableLineRef } from '../purchasables/purchasable.contract';
import { resolveLineSchedule } from '../pricing/billing';
import { evaluateDiscount } from '../pricing/discounts';
import type { LineDiscount, PricingLine } from '../pricing/pricing';

export const toLineRef = (line: Pick<CartLine, 'sourceType' | 'sourceId' | 'variantId' | 'options' | 'quantity'>): PurchasableLineRef => ({
  sourceType: line.sourceType,
  sourceId: line.sourceId,
  ...(line.variantId ? { variantId: line.variantId } : {}),
  options: line.options,
  quantity: line.quantity,
});

const optionsKey = (options: Record<string, string>): string =>
  JSON.stringify(Object.keys(options).sort().map((key) => [key, options[key]]));

// Two cart entries are the same line only if every identifying field matches - the same class for
// two different children (different options) stays two lines.
export const isSameLine = (a: Omit<PurchasableLineRef, 'quantity'>, b: Omit<PurchasableLineRef, 'quantity'>): boolean =>
  a.sourceType === b.sourceType &&
  a.sourceId === b.sourceId &&
  (a.variantId ?? '') === (b.variantId ?? '') &&
  optionsKey(a.options) === optionsKey(b.options);

export type LineResolution = { ok: true; line: PricingLine } | { ok: false; reason: string };

export const resolveLine = async (lineId: string, ref: PurchasableLineRef, ctx: PurchasableContext): Promise<LineResolution> => {
  const source = findPurchasableSource(ref.sourceType);
  if (!source) return { ok: false, reason: 'This item is no longer available.' };

  const resolved = await source.resolve(ref, ctx);
  if (!resolved) return { ok: false, reason: 'This item is no longer available.' };

  if (resolved.maxQuantity !== undefined && ref.quantity > resolved.maxQuantity) {
    return {
      ok: false,
      reason: resolved.maxQuantity <= 0 ? 'This item is sold out.' : `Only ${resolved.maxQuantity} of this item are available.`,
    };
  }

  const validation = source.validate ? await source.validate(ref, resolved, ctx) : { ok: true as const };
  if (!validation.ok) return { ok: false, reason: validation.reason };

  return { ok: true, line: { lineId, ref, resolved, schedule: resolveLineSchedule(resolved.billing, ctx.now) } };
};

export interface UnavailableLine {
  line: CartLine;
  reason: string;
}

export interface ResolvedCartLines {
  available: PricingLine[];
  unavailable: UnavailableLine[];
}

export const resolveCartLines = async (lines: CartLine[], ctx: PurchasableContext): Promise<ResolvedCartLines> => {
  const resolutions = await Promise.all(lines.map((line) => resolveLine(line.id, toLineRef(line), ctx)));
  return resolutions.reduce<ResolvedCartLines>(
    (acc, resolution, index) =>
      resolution.ok
        ? { ...acc, available: [...acc.available, resolution.line] }
        : { ...acc, unavailable: [...acc.unavailable, { line: lines[index], reason: resolution.reason }] },
    { available: [], unavailable: [] },
  );
};

export interface CartDiscountState {
  code: string;
  applied: boolean;
  message?: string;
  discount?: DiscountEntity;
  allocation: Map<string, LineDiscount>;
}

// Re-evaluates the cart's code against the current lines every time - a code valid when applied
// can stop applying (expired, used up, qualifying item removed), and pricing must reflect that.
export const evaluateCartDiscount = async (
  code: string | null,
  lines: PricingLine[],
  ctx: PurchasableContext,
): Promise<CartDiscountState | null> => {
  if (!code) return null;

  const discount = await getDiscountRepository().findByCode(code);
  if (!discount) return { code, applied: false, message: 'This code is not valid.', allocation: new Map() };

  const userRedemptions = await getOrderRepository().countRedemptionsByUser(ctx.userId, discount.id);
  const evaluation = evaluateDiscount(discount, lines, { now: ctx.now, userRedemptions });
  return evaluation.ok
    ? { code: discount.code, applied: true, discount, allocation: evaluation.allocation }
    : { code: discount.code, applied: false, message: evaluation.message, discount, allocation: new Map() };
};
