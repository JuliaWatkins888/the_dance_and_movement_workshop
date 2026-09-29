import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationError } from '@inithium/api-utils';
import { getCartRepository } from '@inithium/db';
import type { CartEntity, CartLine, LineOptions } from '@inithium/db';
import { findPurchasableSource } from '../purchasables/registry';
import type { PurchasableContext } from '../purchasables/purchasable.contract';
import { priceCart } from '../pricing/pricing';
import { getStoreCurrency } from '../settings';
import { toLineBillingView } from '../views';
import type { CartView, CartViewLine } from '../views';
import { evaluateCartDiscount, isSameLine, resolveCartLines, resolveLine, toLineRef } from './cart-lines';

const MAX_LINE_QUANTITY = 99;

const contextFor = (userId: string): PurchasableContext => ({ userId, now: new Date() });

const emptyCart = (userId: string): CartEntity => ({
  id: '',
  userId,
  lines: [],
  discountCode: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const loadCart = async (userId: string): Promise<CartEntity> =>
  (await getCartRepository().findByUserId(userId)) ?? emptyCart(userId);

const buildCartView = async (cart: CartEntity): Promise<CartView> => {
  const ctx = contextFor(cart.userId);
  const [currency, resolution] = await Promise.all([getStoreCurrency(), resolveCartLines(cart.lines, ctx)]);
  const discountState = await evaluateCartDiscount(cart.discountCode, resolution.available, ctx);
  const priced = priceCart(resolution.available, discountState?.allocation ?? new Map(), null);

  const pricedById = new Map(priced.lines.map((line) => [line.lineId, line]));
  const unavailableById = new Map(resolution.unavailable.map((entry) => [entry.line.id, entry.reason]));

  const lines = cart.lines.map((line): CartViewLine => {
    const base = {
      id: line.id,
      sourceType: line.sourceType,
      sourceId: line.sourceId,
      ...(line.variantId ? { variantId: line.variantId } : {}),
      options: line.options,
      quantity: line.quantity,
    };
    const pricedLine = pricedById.get(line.id);
    if (!pricedLine) {
      return { ...base, available: false, unavailableReason: unavailableById.get(line.id) ?? 'This item is no longer available.' };
    }
    return {
      ...base,
      available: true,
      name: pricedLine.resolved.name,
      description: pricedLine.resolved.description,
      imageUrl: pricedLine.resolved.imageUrl,
      href: pricedLine.resolved.href,
      maxQuantity: pricedLine.resolved.maxQuantity,
      unitAmountCents: pricedLine.unitAmountCents,
      subtotalCents: pricedLine.subtotalCents,
      discountCents: pricedLine.discountCents,
      billing: toLineBillingView(pricedLine),
    };
  });

  return {
    currency,
    lines,
    discount: discountState
      ? { code: discountState.code, applied: discountState.applied, ...(discountState.message ? { message: discountState.message } : {}) }
      : null,
    subtotalCents: priced.subtotalCents,
    discountCents: priced.discountCents,
    totalCents: priced.subtotalCents - priced.discountCents,
    requiresShipping: priced.requiresShipping,
    hasUnavailableLines: resolution.unavailable.length > 0,
  };
};

const assertQuantity = (quantity: number): void => {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
    throw ValidationError(`Quantity must be a whole number between 1 and ${MAX_LINE_QUANTITY}`);
  }
};

// Resolves and validates a line at a prospective quantity before it's written, so the cart never
// stores something its source already rejects.
const assertLineAcceptable = async (userId: string, line: CartLine): Promise<void> => {
  const resolution = await resolveLine(line.id, toLineRef(line), contextFor(userId));
  if (!resolution.ok) throw ValidationError(resolution.reason);
};

export const getCartView = async (userId: string): Promise<CartView> => buildCartView(await loadCart(userId));

export interface AddCartLineInput {
  sourceType: string;
  sourceId: string;
  variantId?: string;
  options?: LineOptions;
  quantity: number;
}

export const addCartLine = async (userId: string, input: AddCartLineInput): Promise<CartView> => {
  assertQuantity(input.quantity);
  if (!findPurchasableSource(input.sourceType)) {
    throw ValidationError(`Unknown item type "${input.sourceType}"`);
  }

  const cart = await loadCart(userId);
  const candidate = {
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    ...(input.variantId ? { variantId: input.variantId } : {}),
    options: input.options ?? {},
  };
  const existing = cart.lines.find((line) => isSameLine(line, candidate));

  const nextLine: CartLine = existing
    ? { ...existing, quantity: existing.quantity + input.quantity }
    : { id: randomUUID(), ...candidate, quantity: input.quantity, addedAt: new Date() };
  assertQuantity(nextLine.quantity);
  await assertLineAcceptable(userId, nextLine);

  const lines = existing ? cart.lines.map((line) => (line.id === existing.id ? nextLine : line)) : [...cart.lines, nextLine];
  return buildCartView(await getCartRepository().save(userId, { lines }));
};

export const updateCartLineQuantity = async (userId: string, lineId: string, quantity: number): Promise<CartView> => {
  assertQuantity(quantity);
  const cart = await loadCart(userId);
  const line = cart.lines.find((candidate) => candidate.id === lineId);
  if (!line) throw NotFoundError('Cart line not found');

  const nextLine = { ...line, quantity };
  await assertLineAcceptable(userId, nextLine);
  const lines = cart.lines.map((candidate) => (candidate.id === lineId ? nextLine : candidate));
  return buildCartView(await getCartRepository().save(userId, { lines }));
};

export const removeCartLine = async (userId: string, lineId: string): Promise<CartView> => {
  const cart = await loadCart(userId);
  if (!cart.lines.some((line) => line.id === lineId)) throw NotFoundError('Cart line not found');
  const lines = cart.lines.filter((line) => line.id !== lineId);
  return buildCartView(await getCartRepository().save(userId, { lines }));
};

export const clearCart = async (userId: string): Promise<CartView> =>
  buildCartView(await getCartRepository().save(userId, { lines: [], discountCode: null }));

// Replaces any code already on the cart - promo codes never stack. An invalid code is rejected
// outright rather than stored, so the shopper gets the reason immediately.
export const applyCartDiscountCode = async (userId: string, code: string): Promise<CartView> => {
  const cart = await loadCart(userId);
  const ctx = contextFor(userId);
  const resolution = await resolveCartLines(cart.lines, ctx);
  const state = await evaluateCartDiscount(code.trim(), resolution.available, ctx);
  if (!state?.applied) {
    throw ValidationError(state?.message ?? 'This code is not valid.');
  }
  return buildCartView(await getCartRepository().save(userId, { discountCode: state.code }));
};

export const removeCartDiscountCode = async (userId: string): Promise<CartView> =>
  buildCartView(await getCartRepository().save(userId, { discountCode: null }));
