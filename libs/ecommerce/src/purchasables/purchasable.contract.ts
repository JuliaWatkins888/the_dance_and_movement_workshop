import type {
  BillingInterval,
  BillingSubscriptionEntity,
  BillingSubscriptionLine,
  LineOptions,
  OrderEntity,
  OrderLine,
} from '@inithium/db';

// What a cart line points at. `options` is opaque source-owned data (a class line's { childId,
// tier }); two lines only merge when every field here matches.
export interface PurchasableLineRef {
  sourceType: string;
  sourceId: string;
  variantId?: string;
  options: LineOptions;
  quantity: number;
}

export interface PurchasableContext {
  userId: string;
  now: Date;
}

export type ResolvedBilling =
  | { type: 'one_time' }
  | {
      type: 'recurring';
      interval: BillingInterval;
      intervalCount: number;
      // Per-unit amount charged at checkout in place of unitAmountCents - e.g. a prorated first
      // month. The first period is always paid at checkout.
      initialAmountCents?: number;
      // When the first automatic renewal is charged. Defaults to one full interval after checkout.
      nextBillingAt?: Date;
      // No renewal is charged at or after this date (e.g. the end of a class term).
      endsAt?: Date;
    };

export interface ResolvedPurchasable {
  name: string;
  description?: string;
  imageUrl?: string;
  // Storefront link back to the item (cart/checkout titles, order history) - each source knows
  // where its own items live, e.g. /merch?item=<slug> or a class detail page.
  href?: string;
  // Per-unit price with any source-level pricing (e.g. a pay-in-full tier discount) already
  // applied - promo codes are layered on top of this by the plugin.
  unitAmountCents: number;
  // Used by item-scoped discount targeting.
  categories: string[];
  taxCode?: string;
  requiresShipping: boolean;
  maxQuantity?: number;
  billing: ResolvedBilling;
}

export type PurchasableValidation = { ok: true } | { ok: false; reason: string };

// The extension point every purchasable collection implements - the plugin's own `product`
// source and any client-level source (classes, tickets, ...) alike. Cart, checkout, discounts,
// orders, and subscriptions only ever go through this, never through a source's own collection.
export interface PurchasableSource {
  sourceType: string;
  // null when the item no longer exists or is no longer for sale.
  resolve: (ref: PurchasableLineRef, ctx: PurchasableContext) => Promise<ResolvedPurchasable | null>;
  // Business rules beyond existence (a required attendee chosen, registration open, not already
  // enrolled). Runs when a line is added and again at checkout.
  validate?: (ref: PurchasableLineRef, resolved: ResolvedPurchasable, ctx: PurchasableContext) => Promise<PurchasableValidation>;
  // Atomically claims stock/seats right before payment; false when there aren't enough left.
  reserve?: (ref: PurchasableLineRef, ctx: PurchasableContext) => Promise<boolean>;
  // Gives back a reservation whose payment never completed.
  release?: (ref: PurchasableLineRef, ctx: PurchasableContext) => Promise<void>;
  // Fulfillment once the checkout charge succeeds (e.g. enroll the attendee).
  onPaid?: (line: OrderLine, order: OrderEntity) => Promise<void>;
  // Each successful automatic renewal of a subscription line.
  onRenewalPaid?: (line: BillingSubscriptionLine, subscription: BillingSubscriptionEntity, order: OrderEntity) => Promise<void>;
  // A subscription line stopped billing (dropped, canceled, or ran to its end). paidThrough is the
  // end of the last period already paid for, so the source can decide when access actually ends.
  onSubscriptionLineEnded?: (
    line: BillingSubscriptionLine,
    subscription: BillingSubscriptionEntity,
    paidThrough: Date | undefined,
  ) => Promise<void>;
}
