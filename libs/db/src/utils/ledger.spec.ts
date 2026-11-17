import { describe, expect, it } from 'vitest';
import type { LedgerAllocation } from '../contracts/ledger-entry.contract';
import { autoApply, computeBalance, ledgerPosition, openCharges } from './ledger';
import type { LedgerBalanceEntry } from './ledger';

const day = (n: number): Date => new Date(Date.UTC(2026, 10, n));

const charge = (id: string, amountCents: number, createdOn = 1, voided = false): LedgerBalanceEntry => ({
  id,
  kind: 'charge',
  amountCents,
  createdAt: day(createdOn),
  ...(voided ? { voidedAt: day(20) } : {}),
});

const payment = (id: string, amountCents: number, appliesTo?: LedgerAllocation[], voided = false): LedgerBalanceEntry => ({
  id,
  kind: 'payment',
  amountCents,
  createdAt: day(10),
  ...(appliesTo ? { appliesTo } : {}),
  ...(voided ? { voidedAt: day(20) } : {}),
});

describe('computeBalance', () => {
  it('is zero for an empty account', () => {
    expect(computeBalance([])).toBe(0);
  });

  it('is what the family owes after a charge', () => {
    expect(computeBalance([charge('costume', 4500)])).toBe(4500);
  });

  it('goes negative when a payment exceeds the charges', () => {
    expect(computeBalance([payment('cash', 2200)])).toBe(-2200);
  });

  it('ignores voided entries of both kinds', () => {
    expect(computeBalance([charge('a', 4500, 1, true), charge('b', 1000), payment('p', 500, undefined, true)])).toBe(1000);
  });
});

describe('ledgerPosition', () => {
  it('fills explicit allocations first', () => {
    const entries = [charge('old', 1000, 1), charge('new', 1000, 2), payment('p', 1000, [{ chargeId: 'new', amountCents: 1000 }])];
    expect(openCharges(entries)).toEqual([{ chargeId: 'old', remainingCents: 1000 }]);
  });

  it('spreads an unapplied payment over charges oldest first', () => {
    const entries = [charge('new', 4500, 2), charge('old', 2000, 1), payment('cash', 2200)];
    expect(openCharges(entries)).toEqual([{ chargeId: 'new', remainingCents: 4300 }]);
  });

  it('keeps a payment larger than the charges as a credit', () => {
    expect(ledgerPosition([charge('a', 1000), payment('p', 2500)])).toEqual({ openCharges: [], creditCents: 1500 });
  });

  it('applies an existing credit to a charge added later', () => {
    const entries = [payment('cash', 2200), charge('dropin', 2200, 15)];
    expect(ledgerPosition(entries)).toEqual({ openCharges: [], creditCents: 0 });
  });

  it('frees a payment when the charge it paid is voided', () => {
    const entries = [charge('voided', 1000, 1, true), charge('other', 1500, 2), payment('p', 1000, [{ chargeId: 'voided', amountCents: 1000 }])];
    expect(ledgerPosition(entries)).toEqual({ openCharges: [{ chargeId: 'other', remainingCents: 500 }], creditCents: 0 });
  });

  it('reopens a charge when its payment is voided', () => {
    const entries = [charge('a', 1000), payment('p', 1000, [{ chargeId: 'a', amountCents: 1000 }], true)];
    expect(openCharges(entries)).toEqual([{ chargeId: 'a', remainingCents: 1000 }]);
  });

  it('caps an over-allocation at the charge and keeps the rest as credit', () => {
    const entries = [charge('a', 1000), payment('p', 1500, [{ chargeId: 'a', amountCents: 1500 }])];
    expect(ledgerPosition(entries)).toEqual({ openCharges: [], creditCents: 500 });
  });

  it('nets a refunded online order back to zero', () => {
    const entries = [
      charge('order', 5000),
      payment('card', 5000, [{ chargeId: 'order', amountCents: 5000 }]),
      charge('reversal', -5000, 11),
      payment('refund', -5000, [{ chargeId: 'order', amountCents: -5000 }]),
    ];
    expect(computeBalance(entries)).toBe(0);
    expect(ledgerPosition(entries)).toEqual({ openCharges: [], creditCents: 0 });
  });

  it('reopens a costume charge when the card payment for it is refunded', () => {
    const entries = [
      charge('costume', 4500),
      payment('card', 4500, [{ chargeId: 'costume', amountCents: 4500 }]),
      payment('refund', -4500, [{ chargeId: 'costume', amountCents: -4500 }]),
    ];
    expect(computeBalance(entries)).toBe(4500);
    expect(openCharges(entries)).toEqual([{ chargeId: 'costume', remainingCents: 4500 }]);
  });

  it('always agrees with computeBalance', () => {
    const entries = [
      charge('a', 1000, 1),
      charge('b', 2500, 2),
      charge('c', 700, 3, true),
      payment('p1', 1200),
      payment('p2', 800, [{ chargeId: 'b', amountCents: 800 }]),
    ];
    const { openCharges: open, creditCents } = ledgerPosition(entries);
    expect(open.reduce((sum, item) => sum + item.remainingCents, 0) - creditCents).toBe(computeBalance(entries));
  });
});

describe('autoApply', () => {
  const open = [
    { chargeId: 'a', remainingCents: 1000 },
    { chargeId: 'b', remainingCents: 2000 },
  ];

  it('fills charges in order and stops when the money runs out', () => {
    expect(autoApply(1500, open)).toEqual([
      { chargeId: 'a', amountCents: 1000 },
      { chargeId: 'b', amountCents: 500 },
    ]);
  });

  it('leaves a surplus unallocated', () => {
    expect(autoApply(5000, open)).toEqual([
      { chargeId: 'a', amountCents: 1000 },
      { chargeId: 'b', amountCents: 2000 },
    ]);
  });

  it('allocates nothing when there are no open charges', () => {
    expect(autoApply(1500, [])).toEqual([]);
  });
});
