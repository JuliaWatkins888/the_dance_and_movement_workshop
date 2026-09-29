import { getOrderRepository } from '@inithium/db';
import type { SalesBucket } from '@inithium/db';
import { getStoreCurrency } from '../settings';

export const SALES_PERIODS = ['week', 'month', 'year'] as const;
export type SalesPeriod = (typeof SALES_PERIODS)[number];

// week: the last 7 days, by day; month: the last 30 days, by day; year: the last 12 months, by month.
const PERIOD_SHAPES: Record<SalesPeriod, { unit: 'day' | 'month'; buckets: number }> = {
  week: { unit: 'day', buckets: 7 },
  month: { unit: 'day', buckets: 30 },
  year: { unit: 'month', buckets: 12 },
};

export interface SalesReport {
  period: SalesPeriod;
  currency: string;
  timezone: string;
  // Oldest first, one entry per day/month in the window - zero-filled, so a chart never skips one.
  buckets: SalesBucket[];
  totals: {
    revenueCents: number;
    orderCount: number;
    // The same-length window immediately before, for "vs previous period".
    previousRevenueCents: number;
    previousOrderCount: number;
  };
  awaitingFulfillmentCount: number;
}

export const resolveTimezone = (candidate: string | undefined): string => {
  if (!candidate) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate });
    return candidate;
  } catch {
    return 'UTC';
  }
};

// Today's calendar date in `timezone`, as UTC-midnight numbers - date arithmetic on these never
// crosses a DST boundary, unlike stepping real instants by 24 hours.
const calendarToday = (now: Date, timezone: string): { year: number; month: number; day: number } => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const part = (type: string): number => Number(parts.find((entry) => entry.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
};

const pad = (value: number): string => String(value).padStart(2, '0');

const bucketLabels = (period: SalesPeriod, now: Date, timezone: string): string[] => {
  const { unit, buckets } = PERIOD_SHAPES[period];
  const today = calendarToday(now, timezone);
  return Array.from({ length: buckets }, (_, index) => {
    const offset = buckets - 1 - index;
    if (unit === 'day') {
      const date = new Date(Date.UTC(today.year, today.month - 1, today.day - offset));
      return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
    }
    const date = new Date(Date.UTC(today.year, today.month - 1 - offset, 1));
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
  });
};

const WINDOW_DAYS: Record<SalesPeriod, number> = { week: 7, month: 30, year: 366 };
const DAY_MS = 86_400_000;

export const getSalesReport = async (period: SalesPeriod, timezoneInput: string | undefined, now = new Date()): Promise<SalesReport> => {
  const timezone = resolveTimezone(timezoneInput);
  const labels = bucketLabels(period, now, timezone);
  const { unit } = PERIOD_SHAPES[period];

  // Queried a day wider than the window so the first local day is complete in any timezone; only
  // buckets whose label is in the window are kept.
  const windowMs = WINDOW_DAYS[period] * DAY_MS;
  const from = new Date(now.getTime() - windowMs - DAY_MS);
  const orders = getOrderRepository();
  const [rows, previous, awaitingFulfillmentCount, currency] = await Promise.all([
    orders.aggregateSales({ from, to: now, unit, timezone }),
    orders.sumSales(new Date(now.getTime() - 2 * windowMs), new Date(now.getTime() - windowMs)),
    orders.countAwaitingFulfillment(),
    getStoreCurrency(),
  ]);

  const byLabel = new Map(rows.map((row) => [row.label, row]));
  const buckets = labels.map((label) => byLabel.get(label) ?? { label, revenueCents: 0, orderCount: 0 });

  return {
    period,
    currency,
    timezone,
    buckets,
    totals: {
      revenueCents: buckets.reduce((sum, bucket) => sum + bucket.revenueCents, 0),
      orderCount: buckets.reduce((sum, bucket) => sum + bucket.orderCount, 0),
      previousRevenueCents: previous.revenueCents,
      previousOrderCount: previous.orderCount,
    },
    awaitingFulfillmentCount,
  };
};
