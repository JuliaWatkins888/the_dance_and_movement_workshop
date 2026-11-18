import { randomUUID } from 'node:crypto';
import { AppError, ConflictError, NotFoundError, ValidationError, logError } from '@inithium/api-utils';
import { getLedgerEntryRepository, getOrderRepository, getShippingMethodRepository, getUserRepository } from '@inithium/db';
import type {
  CreateOrderInput,
  LedgerPaymentMethod,
  LineOptions,
  OrderEntity,
  PostalAddress,
  ShippingMethodEntity,
  UserEntity,
} from '@inithium/db';
import { getPaymentProvider } from '@inithium/payments';
import type { PaymentResult } from '@inithium/payments';
import { evaluateCartDiscount, resolveLine } from '../cart/cart-lines';
import { settlePayment } from '../checkout/checkout.service';
import type { PlaceOrderResult } from '../checkout/checkout.service';
import { failOrder, finalizeOrder, reserveOrderLines, sweepStalePendingOrders } from '../checkout/order-lifecycle';
import { toOrderDiscountSnapshot, toOrderLine } from '../checkout/order-snapshot';
import { ensurePaymentCustomer } from '../checkout/payment-customer';
import { calculateOrderTax } from '../checkout/prepare-checkout';
import type { OrderTax } from '../checkout/prepare-checkout';
import { buildQuoteView } from '../checkout/quote-view';
import { recordLedgerPayment } from '../ledger/ledger.service';
import { accrueLedgerTuition } from '../ledger/tuition-accrual';
import {
  POLICY_CONSENT_REQUIRED,
  getPolicyConsentStatusForLines,
  recordDeskPolicyConsent,
} from '../policy-consent/policy-consent.service';
import type { PolicyConsentStatus } from '../policy-consent/policy-consent.service';
import { priceCart } from '../pricing/pricing';
import type { PricedCart } from '../pricing/pricing';
import type { PurchasableLineRef } from '../purchasables/purchasable.contract';
import { getStoreCurrency } from '../settings';
import type { CheckoutQuote } from '../views';
import { LEDGER_PAYMENT_PROVIDER, MANUAL_PAYMENT_PROVIDER } from './payment-collection';

export { MANUAL_PAYMENT_PROVIDER } from './payment-collection';

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

export type DeskPaymentMethod = Exclude<LedgerPaymentMethod, 'card_online'>;

export interface DeskPaymentRecord {
  method: DeskPaymentMethod;
  amountCents: number;
  checkNumber?: string;
}

// card      - the family's card, entered in the payment form on the staff member's screen. Charged
//             now; a monthly plan renews on it exactly like an online one.
// in_person - nothing is charged: the order is owed on the account ledger, optionally with the
//             cash/check payment taken at the desk recorded against it straight away.
export type DeskPayment =
  | { mode: 'card'; billingAddress: PostalAddress; paymentToken?: string; expectedTotalCents: number }
  | { mode: 'in_person'; record?: DeskPaymentRecord };

// desk  - the family typed their name on the staff member's screen
// paper - the family signed a paper copy, which staff attest to
export interface DeskConsentInput {
  method: 'desk' | 'paper';
  signedName: string;
  versionHash: string;
}

export interface DeskOrderInput extends ManualOrderInput {
  payment: DeskPayment;
  consent?: DeskConsentInput;
}

export interface DeskQuoteInput extends ManualOrderInput {
  // Card payments are taxed like an online checkout, so the quote needs the billing address.
  billingAddress?: PostalAddress;
}

export interface DeskQuote {
  quote: CheckoutQuote;
  hasRecurring: boolean;
  policy: PolicyConsentStatus;
}

interface PrepareOptions {
  // Recurring lines start a subscription or ledger billing; the plain manual order can do neither.
  allowRecurring: boolean;
  billingAddress?: PostalAddress;
}

interface PreparedManualOrder {
  customer: UserEntity;
  currency: string;
  refs: PurchasableLineRef[];
  priced: PricedCart;
  discount: Awaited<ReturnType<typeof evaluateCartDiscount>>;
  shippingMethod: ShippingMethodEntity | null;
  orderTax: OrderTax | null;
  quote: CheckoutQuote;
}

const lineKey = (ref: PurchasableLineRef): string =>
  JSON.stringify([ref.sourceType, ref.sourceId, ref.variantId ?? '', Object.entries(ref.options).sort(([a], [b]) => a.localeCompare(b))]);

const prepareManualOrder = async (input: ManualOrderInput, options: PrepareOptions): Promise<PreparedManualOrder> => {
  const customer = await getUserRepository().findById(input.customerUserId);
  if (!customer) throw NotFoundError('Customer not found');
  if (input.lines.length === 0) throw ValidationError('Add at least one item');
  if (input.lines.length > MAX_MANUAL_ORDER_LINES) throw ValidationError(`An order can have at most ${MAX_MANUAL_ORDER_LINES} items`);

  // Availability and each source's own rules are checked for the customer, not the staff member.
  const refs: PurchasableLineRef[] = input.lines.map((line) => ({
    sourceType: line.sourceType,
    sourceId: line.sourceId,
    ...(line.variantId ? { variantId: line.variantId } : {}),
    options: line.options ?? {},
    quantity: line.quantity,
  }));
  // A cart merges identical lines; a staff order is a plain list, so repeats are caught here.
  if (new Set(refs.map(lineKey)).size !== refs.length) throw ValidationError('The same item was added twice. Remove the duplicate.');

  const ctx = { userId: customer.id, now: new Date(), lines: refs };
  const resolutions = await Promise.all(refs.map((ref) => resolveLine(randomUUID(), ref, ctx)));
  const problems = resolutions.flatMap((resolution, index) => (resolution.ok ? [] : [{ index, reason: resolution.reason }]));
  if (problems.length > 0) throw ValidationError('Some items can’t be added to this order', { lines: problems });

  const lines = resolutions.flatMap((resolution) => (resolution.ok ? [resolution.line] : []));
  const recurring = lines.find((line) => line.resolved.billing.type === 'recurring');
  if (recurring && !options.allowRecurring) {
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
  const shippingAddress = shippingMethod?.requiresAddress ? input.shippingAddress : undefined;
  const orderTax = options.billingAddress ? await calculateOrderTax(currency, priced, options.billingAddress, shippingAddress) : null;
  const quote = buildQuoteView({
    currency,
    priced,
    taxByLineId: orderTax?.taxByLineId ?? new Map(),
    taxTotalCents: orderTax?.tax.totalTaxCents ?? 0,
    discountState: discount,
    shippingMethod,
  });

  return { customer, currency, refs, priced, discount, shippingMethod, orderTax, quote };
};

interface PendingOrderOptions {
  provider: string;
  actorUserId: string;
  note: string;
  billingAddress?: PostalAddress;
}

const buildPendingOrder = (input: ManualOrderInput, prepared: PreparedManualOrder, options: PendingOrderOptions): CreateOrderInput => {
  const { priced, quote, orderTax } = prepared;
  return {
    userId: input.customerUserId,
    kind: 'manual',
    status: 'pending',
    currency: prepared.currency,
    lines: priced.lines.map((line) => toOrderLine(line, orderTax?.taxByLineId.get(line.lineId) ?? 0)),
    totals: {
      subtotalCents: quote.subtotalCents,
      discountCents: quote.discountCents,
      shippingCents: quote.shippingCents,
      taxCents: quote.taxCents,
      totalCents: quote.totalCents,
    },
    ...(prepared.discount?.discount ? { discount: toOrderDiscountSnapshot(prepared.discount.discount) } : {}),
    ...(prepared.shippingMethod
      ? { shipping: { methodId: prepared.shippingMethod.id, name: prepared.shippingMethod.name, amountCents: quote.shippingCents } }
      : {}),
    ...(input.shippingAddress ? { shippingAddress: input.shippingAddress } : {}),
    ...(options.billingAddress ? { billingAddress: options.billingAddress } : {}),
    payment: {
      provider: options.provider,
      ...(orderTax?.tax.calculationId ? { taxCalculationId: orderTax.tax.calculationId } : {}),
    },
    subscriptionIds: [],
    fulfillmentErrors: [],
    statusHistory: [{ status: 'pending', at: new Date(), actorUserId: options.actorUserId, note: options.note }],
    ...(input.internalNotes?.trim() ? { internalNotes: input.internalNotes.trim() } : {}),
    createdByUserId: options.actorUserId,
  };
};

// Prices a manual order without creating it, so staff can review totals first.
export const quoteManualOrder = async (input: ManualOrderInput): Promise<CheckoutQuote> =>
  (await prepareManualOrder(input, { allowRecurring: false })).quote;

export const createManualOrder = async (input: ManualOrderInput, actorUserId: string): Promise<OrderEntity> => {
  const prepared = await prepareManualOrder(input, { allowRecurring: false });
  const pending = await getOrderRepository().create(
    buildPendingOrder(input, prepared, { provider: MANUAL_PAYMENT_PROVIDER, actorUserId, note: 'Recorded by staff' }),
  );

  // Same claim-then-fulfill path as a checkout: a shortfall fails the order and throws, and
  // finalizing runs the promo redemption and each source's onPaid hook (e.g. an enrollment).
  const reserved = await reserveOrderLines(pending);
  return (await finalizeOrder(reserved.id)) ?? reserved;
};

// Totals plus whether the family still has to sign the studio policies for these items.
export const quoteDeskOrder = async (input: DeskQuoteInput): Promise<DeskQuote> => {
  const prepared = await prepareManualOrder(input, {
    allowRecurring: true,
    ...(input.billingAddress ? { billingAddress: input.billingAddress } : {}),
  });
  return {
    quote: prepared.quote,
    hasRecurring: prepared.priced.hasRecurring,
    policy: await getPolicyConsentStatusForLines(prepared.customer.id, prepared.refs),
  };
};

const fullName = (user: Pick<UserEntity, 'firstName' | 'lastName'>): string => [user.firstName, user.lastName].filter(Boolean).join(' ');

const assertDeskPayment = (payment: DeskPayment, prepared: PreparedManualOrder): void => {
  if (payment.mode !== 'card') return;
  const { quote, priced } = prepared;
  if (quote.totalCents !== payment.expectedTotalCents) {
    throw ConflictError('The order total changed. Please review it before charging the card.', { quote });
  }
  // Renewals are charged to the card saved by today's charge, as at online checkout.
  if (quote.totalCents === 0 && priced.hasRecurring) throw ValidationError('An order that starts a monthly plan must include a payment today.');
  if (quote.totalCents > 0 && !payment.paymentToken) throw ValidationError('Card details are required');
};

// Records the cash/check taken at the desk against the charges this order just put on the ledger.
// The order itself is already complete, so a failure here is reported but doesn't undo it.
const recordDeskPayment = async (order: OrderEntity, record: DeskPaymentRecord, actorUserId: string): Promise<OrderEntity> => {
  try {
    const charges = (await getLedgerEntryRepository().findByOrderId(order.id)).filter(
      (entry) => entry.kind === 'charge' && entry.amountCents > 0 && !entry.voidedAt,
    );
    await recordLedgerPayment(
      order.userId,
      {
        amountCents: record.amountCents,
        method: record.method,
        ...(record.checkNumber ? { checkNumber: record.checkNumber } : {}),
        receivedAt: new Date(),
        ...(charges.length > 0 ? { chargeIds: charges.map((charge) => charge.id) } : {}),
      },
      actorUserId,
    );
    return order;
  } catch (error) {
    logError(error);
    const message = error instanceof Error ? error.message : String(error);
    return (
      (await getOrderRepository().update(order.id, {
        fulfillmentErrors: [...order.fulfillmentErrors, `Desk payment wasn’t recorded (${message}). Record it from Accounts.`],
      })) ?? order
    );
  }
};

const chargeDeskCard = async (order: OrderEntity, prepared: PreparedManualOrder, payment: Extract<DeskPayment, { mode: 'card' }>) => {
  const provider = getPaymentProvider();
  let result: PaymentResult;
  try {
    const customerId = await ensurePaymentCustomer(order.userId, payment.billingAddress);
    result = await provider.charge({
      customerId,
      amountCents: prepared.quote.totalCents,
      currency: prepared.currency,
      paymentToken: payment.paymentToken!,
      savePaymentMethod: prepared.priced.hasRecurring,
      description: `Order ${order.id}`,
      metadata: { orderId: order.id, userId: order.userId },
      idempotencyKey: `order-${order.id}-charge`,
    });
  } catch (error) {
    await failOrder(order.id, 'Payment could not be processed');
    throw error;
  }

  const withPayment =
    (await getOrderRepository().update(order.id, {
      payment: {
        ...order.payment,
        ...(result.paymentId ? { paymentId: result.paymentId } : {}),
        ...(result.paymentMethodId ? { paymentMethodId: result.paymentMethodId } : {}),
      },
    })) ?? order;
  return settlePayment(withPayment, result);
};

// Staff registering a family at the front desk: the same lines, eligibility, capacity, promo and
// policy rules as online checkout, paid by card now or owed on the account ledger.
export const createDeskOrder = async (input: DeskOrderInput, actorUserId: string): Promise<PlaceOrderResult> => {
  const { payment } = input;
  if (payment.mode === 'card') await sweepStalePendingOrders();

  const prepared = await prepareManualOrder(input, {
    allowRecurring: true,
    ...(payment.mode === 'card' ? { billingAddress: payment.billingAddress } : {}),
  });
  assertDeskPayment(payment, prepared);

  const policy = await getPolicyConsentStatusForLines(prepared.customer.id, prepared.refs);
  const consent = input.consent;
  if (policy.required && !consent) {
    throw new AppError(403, POLICY_CONSENT_REQUIRED, 'The family needs to sign the studio policies before registering.', {
      outstandingSchoolYears: policy.outstandingSchoolYears,
    });
  }

  const actor = await getUserRepository().findById(actorUserId);
  const pending = await getOrderRepository().create(
    buildPendingOrder(input, prepared, {
      provider: payment.mode === 'card' ? getPaymentProvider().name : LEDGER_PAYMENT_PROVIDER,
      actorUserId,
      note: payment.mode === 'card' ? 'Registered at the front desk, card payment' : 'Registered at the front desk, pay in person',
      ...(payment.mode === 'card' ? { billingAddress: payment.billingAddress } : {}),
    }),
  );

  // Signed before anything is reserved or charged, and tied to this order. A signature stays on
  // file even if the payment then fails: the family did agree.
  if (policy.required && consent) {
    try {
      await recordDeskPolicyConsent(prepared.customer.id, prepared.refs, {
        method: consent.method,
        versionHash: consent.versionHash,
        signedName: consent.signedName,
        recordedByUserId: actorUserId,
        recordedByName: actor ? fullName(actor) : 'Staff',
        orderId: pending.id,
      });
    } catch (error) {
      await failOrder(pending.id, 'Policy signature could not be recorded');
      throw error;
    }
  }

  const reserved = await reserveOrderLines(pending);

  if (payment.mode === 'in_person') {
    const finalized = (await finalizeOrder(reserved.id)) ?? reserved;
    await accrueLedgerTuition(finalized.userId);
    const order = payment.record ? await recordDeskPayment(finalized, payment.record, actorUserId) : finalized;
    return { status: 'paid', order };
  }

  if (prepared.quote.totalCents === 0) return { status: 'paid', order: (await finalizeOrder(reserved.id)) ?? reserved };
  return chargeDeskCard(reserved, prepared, payment);
};
