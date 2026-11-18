import type { LedgerAllocation, LedgerEntryEntity } from '../contracts/ledger-entry.contract';

export type LedgerBalanceEntry = Pick<LedgerEntryEntity, 'id' | 'kind' | 'amountCents' | 'appliesTo' | 'voidedAt' | 'createdAt'>;

export interface OpenCharge {
  chargeId: string;
  remainingCents: number;
}

export interface LedgerPosition {
  // Oldest first, with every unapplied payment already spread over them.
  openCharges: OpenCharge[];
  // Money on the account that no open charge can absorb.
  creditCents: number;
}

const isLive = (entry: LedgerBalanceEntry): boolean => !entry.voidedAt;

const byOldest = (a: LedgerBalanceEntry, b: LedgerBalanceEntry): number =>
  a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);

// Positive means the family owes the studio, negative means the studio holds a credit.
export const computeBalance = (entries: LedgerBalanceEntry[]): number =>
  entries.filter(isLive).reduce((sum, entry) => sum + (entry.kind === 'charge' ? entry.amountCents : -entry.amountCents), 0);

// Derived from the entries on every read rather than stored, so voiding anything corrects the
// picture by itself: an allocation to a voided charge simply stops counting and its money flows
// back into the pool for the next oldest open charge.
export const ledgerPosition = (entries: LedgerBalanceEntry[]): LedgerPosition => {
  const live = entries.filter(isLive);
  const charges = live.filter((entry) => entry.kind === 'charge' && entry.amountCents > 0).sort(byOldest);
  const payments = live.filter((entry) => entry.kind === 'payment');

  const allocatedByCharge = new Map<string, number>();
  for (const payment of payments) {
    for (const { chargeId, amountCents } of payment.appliesTo ?? []) {
      allocatedByCharge.set(chargeId, (allocatedByCharge.get(chargeId) ?? 0) + amountCents);
    }
  }

  const settled = charges.map((charge) => ({
    chargeId: charge.id,
    amountCents: charge.amountCents,
    appliedCents: Math.min(Math.max(allocatedByCharge.get(charge.id) ?? 0, 0), charge.amountCents),
  }));

  const paidCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  // A negative charge reverses a refunded order, so it counts the same as money on the account.
  const creditedCents = live
    .filter((entry) => entry.kind === 'charge' && entry.amountCents < 0)
    .reduce((sum, entry) => sum - entry.amountCents, 0);
  const appliedCents = settled.reduce((sum, charge) => sum + charge.appliedCents, 0);

  let pool = paidCents + creditedCents - appliedCents;
  const openCharges: OpenCharge[] = [];
  for (const charge of settled) {
    const owed = charge.amountCents - charge.appliedCents;
    const fromPool = Math.min(Math.max(pool, 0), owed);
    pool -= fromPool;
    if (owed > fromPool) openCharges.push({ chargeId: charge.chargeId, remainingCents: owed - fromPool });
  }

  return { openCharges, creditCents: Math.max(pool, 0) };
};

export const openCharges = (entries: LedgerBalanceEntry[]): OpenCharge[] => ledgerPosition(entries).openCharges;

// Fills the given charges in order until the amount runs out; anything left stays unapplied, which
// makes it a credit on the account.
export const autoApply = (amountCents: number, charges: OpenCharge[]): LedgerAllocation[] => {
  const allocations: LedgerAllocation[] = [];
  let left = amountCents;
  for (const charge of charges) {
    if (left <= 0) break;
    const applied = Math.min(left, charge.remainingCents);
    if (applied > 0) allocations.push({ chargeId: charge.chargeId, amountCents: applied });
    left -= applied;
  }
  return allocations;
};
