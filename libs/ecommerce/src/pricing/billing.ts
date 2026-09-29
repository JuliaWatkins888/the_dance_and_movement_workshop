import type { BillingInterval } from '@inithium/db';
import type { ResolvedBilling } from '../purchasables/purchasable.contract';

export interface LineSchedule {
  interval: BillingInterval;
  intervalCount: number;
  firstBillingAt: Date;
  endsAt?: Date;
}

const daysInUtcMonth = (year: number, month: number): number => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

// Month/year steps clamp to the target month's last day (Jan 31 + 1 month = Feb 28/29) rather
// than letting Date roll over into the following month.
export const addInterval = (date: Date, interval: BillingInterval, count: number): Date => {
  if (interval === 'day' || interval === 'week') {
    const days = interval === 'day' ? count : count * 7;
    return new Date(date.getTime() + days * 86_400_000);
  }
  const months = interval === 'month' ? count : count * 12;
  const totalMonths = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12;
  const day = Math.min(date.getUTCDate(), daysInUtcMonth(year, month));
  return new Date(
    Date.UTC(year, month, day, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()),
  );
};

// The renewal schedule a recurring line will get, or null when it needs no subscription at all -
// a one-time line, or a recurring one whose term ends before its first renewal would be due (the
// checkout charge already covers the whole term).
export const resolveLineSchedule = (billing: ResolvedBilling, now: Date): LineSchedule | null => {
  if (billing.type !== 'recurring') return null;
  const firstBillingAt =
    billing.nextBillingAt && billing.nextBillingAt > now
      ? billing.nextBillingAt
      : addInterval(now, billing.interval, billing.intervalCount);
  if (billing.endsAt && billing.endsAt <= firstBillingAt) return null;
  return {
    interval: billing.interval,
    intervalCount: billing.intervalCount,
    firstBillingAt,
    ...(billing.endsAt ? { endsAt: billing.endsAt } : {}),
  };
};

// Lines sharing a key renew together on one provider subscription (one charge per cycle).
export const scheduleKey = (schedule: LineSchedule): string =>
  [schedule.interval, schedule.intervalCount, schedule.firstBillingAt.toISOString(), schedule.endsAt?.toISOString() ?? ''].join('|');
