import { ValidationError } from '@inithium/api-utils';
import { getCartRepository, getShippingMethodRepository } from '@inithium/db';
import type { CartEntity, PostalAddress, ShippingMethodEntity } from '@inithium/db';
import { getTaxProvider } from '@inithium/payments';
import type { TaxCalculation } from '@inithium/payments';
import { evaluateCartDiscount, resolveCartLines } from '../cart/cart-lines';
import type { CartDiscountState } from '../cart/cart-lines';
import { priceCart } from '../pricing/pricing';
import type { PricedCart } from '../pricing/pricing';
import { getStoreCurrency } from '../settings';
import type { CheckoutQuote } from '../views';
import { buildQuoteView } from './quote-view';

export interface CheckoutDetailsInput {
  shippingMethodId?: string;
  shippingAddress?: PostalAddress;
  billingAddress: PostalAddress;
}

// Everything checkout knows once the cart is priced and taxed - the same object backs the quote
// the shopper reviews and the order that is placed, so the two can never disagree.
export interface PreparedCheckout {
  userId: string;
  currency: string;
  cart: CartEntity;
  priced: PricedCart;
  discountState: CartDiscountState | null;
  shippingMethod: ShippingMethodEntity | null;
  shippingAddress?: PostalAddress;
  billingAddress: PostalAddress;
  tax: TaxCalculation;
  taxByLineId: Map<string, number>;
  quote: CheckoutQuote;
}

const resolveShipping = async (
  requiresShipping: boolean,
  input: CheckoutDetailsInput,
): Promise<{ method: ShippingMethodEntity | null; address?: PostalAddress }> => {
  if (!requiresShipping) return { method: null };
  if (!input.shippingMethodId) throw ValidationError('Choose a shipping method');

  const method = await getShippingMethodRepository().findById(input.shippingMethodId);
  if (!method || !method.isActive) throw ValidationError('That shipping method is not available');
  if (method.requiresAddress && !input.shippingAddress) throw ValidationError('A shipping address is required');

  return { method, ...(method.requiresAddress && input.shippingAddress ? { address: input.shippingAddress } : {}) };
};

export interface OrderTax {
  tax: TaxCalculation;
  taxByLineId: Map<string, number>;
}

// Goods shipped to an address are taxed where they're delivered; everything else (services,
// pickup) against the billing address.
export const calculateOrderTax = async (
  currency: string,
  priced: PricedCart,
  billingAddress: PostalAddress,
  shippingAddress?: PostalAddress,
): Promise<OrderTax> => {
  const tax = await getTaxProvider().calculate({
    currency,
    address: shippingAddress ?? billingAddress,
    addressSource: shippingAddress ? 'shipping' : 'billing',
    lines: priced.lines.map((line) => ({
      reference: line.lineId,
      amountCents: line.subtotalCents - line.discountCents,
      quantity: line.ref.quantity,
      ...(line.resolved.taxCode ? { taxCode: line.resolved.taxCode } : {}),
    })),
    shippingCents: priced.shippingCents,
  });
  return { tax, taxByLineId: new Map(tax.lines.map((line) => [line.reference, line.taxCents])) };
};

export const prepareCheckout = async (userId: string, input: CheckoutDetailsInput): Promise<PreparedCheckout> => {
  const cart = await getCartRepository().findByUserId(userId);
  if (!cart || cart.lines.length === 0) throw ValidationError('Your cart is empty');

  const ctx = { userId, now: new Date() };
  const resolution = await resolveCartLines(cart.lines, ctx);
  if (resolution.unavailable.length > 0) {
    throw ValidationError('Some items in your cart are no longer available', {
      lines: resolution.unavailable.map(({ line, reason }) => ({ lineId: line.id, reason })),
    });
  }

  const currency = await getStoreCurrency();
  const discountState = await evaluateCartDiscount(cart.discountCode, resolution.available, ctx);
  const requiresShipping = resolution.available.some((line) => line.resolved.requiresShipping);
  const shipping = await resolveShipping(requiresShipping, input);
  const priced = priceCart(resolution.available, discountState?.allocation ?? new Map(), shipping.method);

  const { tax, taxByLineId } = await calculateOrderTax(currency, priced, input.billingAddress, shipping.address);

  const quote: CheckoutQuote = buildQuoteView({
    currency,
    priced,
    taxByLineId,
    taxTotalCents: tax.totalTaxCents,
    discountState,
    shippingMethod: shipping.method,
  });

  return {
    userId,
    currency,
    cart,
    priced,
    discountState,
    shippingMethod: shipping.method,
    ...(shipping.address ? { shippingAddress: shipping.address } : {}),
    billingAddress: input.billingAddress,
    tax,
    taxByLineId,
    quote,
  };
};
