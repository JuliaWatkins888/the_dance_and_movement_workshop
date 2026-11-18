import { describe, expect, it } from 'vitest';
import { ledgerTuitionAccessEndsAt, ledgerTuitionMonths } from './class-pricing';

const utc = (date: string): Date => new Date(`${date}T00:00:00.000Z`);

const terms = { firstMonthCents: 6000, monthlyAmountCents: 6000, discountCents: 0 };
const year = { startsAt: utc('2026-09-01'), endsAt: utc('2027-05-21') };

const months = (now: string, overrides: Partial<Parameters<typeof ledgerTuitionMonths>[0]> = {}) =>
  ledgerTuitionMonths({ terms, ...year, now: utc(now), ...overrides });

describe('ledgerTuitionMonths', () => {
  it('charges only the first month on the day of registration', () => {
    expect(months('2026-09-15').map((month) => month.billingMonth)).toEqual(['2026-09']);
  });

  it('charges the first month at registration even when it starts later', () => {
    expect(months('2026-08-10').map((month) => month.billingMonth)).toEqual(['2026-09']);
  });

  it('adds each following month on its 1st', () => {
    expect(months('2026-10-01').map((month) => month.billingMonth)).toEqual(['2026-09', '2026-10']);
    expect(months('2026-11-30').map((month) => month.billingMonth)).toEqual(['2026-09', '2026-10', '2026-11']);
  });

  it('stops at the month the section ends', () => {
    expect(months('2027-08-01').map((month) => month.billingMonth).at(-1)).toBe('2027-05');
    expect(months('2027-08-01')).toHaveLength(9);
  });

  it('keeps the month of a withdrawal but nothing after it', () => {
    const result = months('2027-01-15', { withdrawnAt: utc('2026-11-20') });
    expect(result.map((month) => month.billingMonth)).toEqual(['2026-09', '2026-10', '2026-11']);
  });

  it('charges the first month even when withdrawn before it starts', () => {
    const result = months('2026-10-15', { startsAt: utc('2026-09-01'), withdrawnAt: utc('2026-08-20') });
    expect(result.map((month) => month.billingMonth)).toEqual(['2026-09']);
  });

  it('uses the first month amount, then the discounted monthly amount for the code’s duration', () => {
    const result = months('2027-01-02', {
      terms: { firstMonthCents: 5000, monthlyAmountCents: 6000, discountCents: 1000, discountMonths: 2 },
    });
    expect(result.map((month) => month.amountCents)).toEqual([5000, 5000, 5000, 6000, 6000]);
  });

  it('discounts every month when the code has no end', () => {
    const result = months('2026-11-01', { terms: { firstMonthCents: 5000, monthlyAmountCents: 6000, discountCents: 1000 } });
    expect(result.map((month) => month.amountCents)).toEqual([5000, 5000, 5000]);
  });
});

describe('ledgerTuitionAccessEndsAt', () => {
  it('runs to the end of the month of the withdrawal', () => {
    expect(ledgerTuitionAccessEndsAt(year.startsAt, year.endsAt, utc('2026-11-20'))).toEqual(utc('2026-12-01'));
  });

  it('runs to the end of the first month when withdrawn before it starts', () => {
    expect(ledgerTuitionAccessEndsAt(year.startsAt, year.endsAt, utc('2026-08-20'))).toEqual(utc('2026-10-01'));
  });

  it('never runs past the section end', () => {
    expect(ledgerTuitionAccessEndsAt(year.startsAt, year.endsAt, utc('2027-05-10'))).toEqual(year.endsAt);
  });
});
