// Shared value types for the ecommerce plugin's collections. All money is stored as integer minor
// units (cents) in the single install-wide currency (the `ecommerce.currency` setting) - never as
// floats, so totals, discounts, and tax allocations can't drift by a fraction of a cent.

export const BILLING_INTERVALS = ['day', 'week', 'month', 'year'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export interface RecurringSchedule {
  interval: BillingInterval;
  intervalCount: number;
}

export type ProductBilling = { type: 'one_time' } | ({ type: 'recurring' } & RecurringSchedule);

// Opaque, source-owned line metadata (e.g. a class line's { childId, tier }). The plugin stores and
// forwards it but never interprets it - only the owning PurchasableSource adapter does.
export type LineOptions = Record<string, string>;

// A partial update where null clears an optional field (undefined leaves it untouched).
export type ClearableUpdate<T> = { [K in keyof T]?: T[K] | null };

export interface PostalAddress {
  name?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  // ISO 3166-1 alpha-2
  country: string;
}
