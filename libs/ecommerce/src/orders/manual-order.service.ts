import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationError } from '@inithium/api-utils';
import { getOrderRepository, getShippingMethodRepository, getUserRepository } from '@inithium/db';
import type { LineOptions, OrderEntity, PostalAddress, ShippingMethodEntity } from '@inithium/db';
import { evaluateCartDiscount, resolveLine } from '../cart/cart-lines';
import { finalizeOrder, reserveOrderLines } from '../checkout/order-lifecycle';
import { toOrderDiscountSnapshot, toOrderLine } from '../checkout/order-snapshot';
import { buildQuoteView } from '../checkout/quote-view';
import { priceCart } from '../pricing/pricing';
import type { PricedCart } from '../pricing/pricing';
import { getStoreCurrency } from '../settings';
import type { CheckoutQuote } from '../views';

export const MANUAL_PAYMENT_PROVIDER = 'manual';
const MAX_MANUAL_ORDER_LINES = 50;

export interface ManualOrderLineInput {
  sourceType: string;
  sourceId: string;
  variantId?: string;
  options?: LineOptions;
  quantity: number;
}

// An order a staff member records on a customer's behalf. Payment already happened outside the
// system, so nothing is charged and no tax is calculated; everything else - availability, stock,
// promo codes, fulfillment hooks - behaves exactly like a checkout.
export interface ManualOrderInput {
  customerUserId: string;
  lines: ManualOrderLineInput[];
  discountCode?: string;
  shippingMethodId?: string;
  shippingAddress?: PostalAddress;
  internalNotes?: string;
}

interface PreparedManualOrder {
  currency: string;
  priced: PricedCart;
  discount: Awaited<ReturnType<typeof evaluateCartDiscount>>;
  shippingMethod: ShippingMethodEntity | null;
  quote: CheckoutQuote;
}

const prepareManualOrder = async (input: ManualOrderInput): Promise<PreparedManualOrder> => {
  const customer = await getUserRepository().findById(input.customerUserId);
  if (!customer) throw NotFoundError('Customer not found');
  if (input.lines.length === 0) throw ValidationError('Add at least one item');
  if (input.lines.length > MAX_MANUAL_ORDER_LINES) throw ValidationError(`An order can have at most ${MAX_MANUAL_ORDER_LINES} items`);

  // Availability and each source's own rules are checked for the customer, not the staff member.
  const ctx = { userId: customer.id, now: new Date() };
  const resolutions = await Promise.all(
    input.lines.map((line) =>
      resolveLine(
        randomUUID(),
        {
          sourceType: line.sourceType,
          sourceId: line.sourceId,
          ...(line.variantId ? { variantId: line.variantId } : {}),
          options: line.options ?? {},
          quantity: line.quantity,
        },
        ctx,
      ),
    ),
  );
  const problems = resolutions.flatMap((resolution, index) => (resolution.ok ? [] : [{ index, reason: resolution.reason }]));
  if (problems.length > 0) throw ValidationError('Some items can’t be added to this order', { lines: problems });

  const lines = resolutions.flatMap((resolution) => (resolution.ok ? [resolution.line] : []));
  // Renewals are charged to a saved payment method, which a staff-recorded order never has.
  const recurring = lines.find((line) => line.resolved.billing.type === 'recurring');
  if (recurring) {
    throw ValidationError(`"${recurring.resolved.name}" is billed on a recurring schedule and can’t be added to a staff-created order.`);
  }

  const code = input.discountCode?.trim();
  const discount = await evaluateCartDiscount(code || null, lines, ctx);
  if (discount && !discount.applied) throw ValidationError(discount.message ?? 'That promo code can’t be applied.');

  let shippingMethod: ShippingMethodEntity | null = null;
  if (input.shippingMethodId) {
    shippingMethod = await getShippingMethodRepository().findById(input.shippingMethodId);
    if (!shippingMethod) throw ValidationError('That shipping method no longer exists');
  }

  const currency = await getStoreCurrency();
  const priced = priceCart(lines, discount?.allocation ?? new Map(), shippingMethod);
  const quote = buildQuoteView({ currency, priced, taxByLineId: new Map(), taxTotalCents: 0, discountState: discount, shippingMethod });

  return { currency, priced, discount, shippingMethod, quote };
};

// Prices a manual order without creating it, so staff can review totals first.
export const quoteManualOrder = async (input: ManualOrderInput): Promise<CheckoutQuote> => (await prepareManualOrder(input)).quote;

export const createManualOrder = async (input: ManualOrderInput, actorUserId: string): Promise<OrderEntity> => {
  const prepared = await prepareManualOrder(input);
  const { priced, quote } = prepared;
  const now = new Date();

  const pending = await getOrderRepository().create({
    userId: input.customerUserId,
    kind: 'manual',
    status: 'pending',
    currency: prepared.currency,
    lines: priced.lines.map((line) => toOrderLine(line, 0)),
    totals: {
      subtotalCents: quote.subtotalCents,
      discountCents: quote.discountCents,
      shippingCents: quote.shippingCents,
      taxCents: 0,
      totalCents: quote.totalCents,
    },
    ...(prepared.discount?.discount ? { discount: toOrderDiscountSnapshot(prepared.discount.discount) } : {}),
    ...(prepared.shippingMethod
      ? { shipping: { methodId: prepared.shippingMethod.id, name: prepared.shippingMethod.name, amountCents: quote.shippingCents } }
      : {}),
    ...(input.shippingAddress ? { shippingAddress: input.shippingAddress } : {}),
    payment: { provider: MANUAL_PAYMENT_PROVIDER },
    subscriptionIds: [],
    fulfillmentErrors: [],
    statusHistory: [{ status: 'pending', at: now, actorUserId, note: 'Recorded by staff' }],
    ...(input.internalNotes?.trim() ? { internalNotes: input.internalNotes.trim() } : {}),
    createdByUserId: actorUserId,
  });

  // Same claim-then-fulfill path as a checkout: a shortfall fails the order and throws, and
  // finalizing runs the promo redemption and each source's onPaid hook (e.g. an enrollment).
  const reserved = await reserveOrderLines(pending);
  return (await finalizeOrder(reserved.id)) ?? reserved;
};
