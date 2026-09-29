import type { BillingInterval } from '@inithium/db';
import type { LineBillingDto, ProductDto, ProductVariantDto } from '../endpoints/ecommerce.endpoints';

// ---- Money ----

// Amounts are integer minor units; the currency's own fraction digits (2 for USD, 0 for JPY)
// decide the divisor, so no currency is hardcoded as "cents".
export const currencyFractionDigits = (currency: string): number =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).resolvedOptions().maximumFractionDigits ?? 2;

export const formatMoney = (amountMinor: number, currency: string): string =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(
    amountMinor / 10 ** currencyFractionDigits(currency),
  );

// Admin money inputs: people type major units ("45", "45.50"); the API stores minor units.
export const formatMinorUnitsForInput = (amountMinor: number | undefined, currency: string): string => {
  if (amountMinor === undefined) return '';
  const digits = currencyFractionDigits(currency);
  return (amountMinor / 10 ** digits).toFixed(digits);
};

// null for anything that isn't a non-negative amount with at most the currency's fraction digits.
export const parseMinorUnitsInput = (value: string, currency: string): number | null => {
  const trimmed = value.trim().replace(/^\$/, '');
  const digits = currencyFractionDigits(currency);
  const pattern = digits > 0 ? new RegExp(`^\\d+(\\.\\d{1,${digits}})?$`) : /^\d+$/;
  if (!pattern.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 10 ** digits);
};

// ---- Billing ----

export const formatBillingInterval = (interval: BillingInterval, intervalCount: number): string =>
  intervalCount === 1 ? interval : `${intervalCount} ${interval}s`;

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

// "then $120.00 / month from Oct 1, 2026 until May 31, 2027" - the renewal half of a recurring
// line's price, shown next to what's charged today.
export const describeRenewal = (billing: LineBillingDto, quantity: number, currency: string): string | null => {
  if (billing.type !== 'recurring') return null;
  const perPeriod = billing.recurringUnitAmountCents * quantity - billing.recurringDiscountCents;
  const until = billing.endsAt ? ` until ${formatDate(billing.endsAt)}` : '';
  return `then ${formatMoney(perPeriod, currency)} / ${formatBillingInterval(billing.interval, billing.intervalCount)} from ${formatDate(billing.firstBillingAt)}${until}`;
};

// ---- Product variants ----

export const variantPrice = (product: ProductDto, variant: ProductVariantDto): number => variant.priceCents ?? product.basePriceCents;

export const isVariantPurchasable = (variant: ProductVariantDto): boolean =>
  variant.isActive && (variant.stockQuantity === null || variant.stockQuantity > 0);

export const purchasableVariants = (product: ProductDto): ProductVariantDto[] => product.variants.filter(isVariantPurchasable);

export const isProductSoldOut = (product: ProductDto): boolean => purchasableVariants(product).length === 0;

// The card's headline price: the cheapest purchasable variant, flagged when variants differ.
export const productPriceRange = (product: ProductDto): { minCents: number; varies: boolean } => {
  const prices = (purchasableVariants(product).length > 0 ? purchasableVariants(product) : product.variants).map((variant) =>
    variantPrice(product, variant),
  );
  const minCents = prices.length > 0 ? Math.min(...prices) : product.basePriceCents;
  return { minCents, varies: new Set(prices).size > 1 };
};

export type VariantSelection = Record<string, string>;

const matchesSelection = (variant: ProductVariantDto, selection: VariantSelection): boolean =>
  Object.entries(selection).every(([name, value]) => variant.optionValues[name] === value);

// The one variant the shopper's choices point at, once every option has a value.
export const findSelectedVariant = (product: ProductDto, selection: VariantSelection): ProductVariantDto | undefined => {
  if (product.options.length === 0) return product.variants.find((variant) => variant.isActive);
  if (product.options.some((option) => !selection[option.name])) return undefined;
  return product.variants.find((variant) => variant.isActive && matchesSelection(variant, selection));
};

// Whether picking `value` for `optionName` (keeping the other current choices) still leads to a
// purchasable variant - drives which size/color buttons are disabled.
export const isOptionValueAvailable = (
  product: ProductDto,
  selection: VariantSelection,
  optionName: string,
  value: string,
): boolean => {
  const candidate = { ...selection, [optionName]: value };
  return product.variants.some((variant) => isVariantPurchasable(variant) && matchesSelection(variant, candidate));
};

// Preselects the first purchasable variant, so a single-variant product (or one with an obvious
// default) is ready to add without any clicks.
export const initialVariantSelection = (product: ProductDto): VariantSelection => {
  const first = purchasableVariants(product)[0];
  return first ? { ...first.optionValues } : {};
};

// ---- API errors ----

export interface ApiErrorInfo {
  status?: number;
  message: string;
  details?: Record<string, unknown>;
}

// Normalizes an RTK Query error (fetchBaseQuery's { status, data } with the API's
// { success: false, error: { code, message, details } } body) into something a component can show.
export const readApiError = (error: unknown, fallback = 'Something went wrong. Please try again.'): ApiErrorInfo => {
  const candidate = error as { status?: unknown; data?: { error?: { message?: string; details?: Record<string, unknown> } } };
  const status = typeof candidate?.status === 'number' ? candidate.status : undefined;
  return {
    ...(status !== undefined ? { status } : {}),
    message: candidate?.data?.error?.message ?? fallback,
    ...(candidate?.data?.error?.details ? { details: candidate.data.error.details } : {}),
  };
};
