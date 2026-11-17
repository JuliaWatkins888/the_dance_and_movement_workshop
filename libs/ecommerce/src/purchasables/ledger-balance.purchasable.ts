import { getLedgerEntryRepository, openCharges } from '@inithium/db';
import type { OpenCharge } from '@inithium/db';
import { LEDGER_BALANCE_SOURCE_TYPE, recordLedgerBalancePayment } from '../ledger/ledger.service';
import type { PurchasableContext, PurchasableLineRef, PurchasableSource, ResolvedPurchasable } from './purchasable.contract';

export { LEDGER_BALANCE_SOURCE_TYPE };

// Stripe Tax's "nontaxable" code. The amount on a ledger charge is exactly what the family pays,
// whether by card online or in cash at the desk, so online payments never have tax added on top.
const NONTAXABLE_TAX_CODE = 'txcd_00000000';

// A balance cart line: sourceId is the buyer's account and options.chargeIds the charges being
// paid. The amount is re-read from the ledger every time the line is priced, so it can't go stale.
const selectedChargeIds = (ref: PurchasableLineRef): string[] => (ref.options['chargeIds'] ?? '').split(',').filter(Boolean);

const loadOpenCharges = async (userId: string): Promise<OpenCharge[]> =>
  openCharges(await getLedgerEntryRepository().findAllByUserId(userId));

const ledgerBalancePurchasable: PurchasableSource = {
  sourceType: LEDGER_BALANCE_SOURCE_TYPE,
  singleCartLine: true,

  resolve: async (ref: PurchasableLineRef, ctx: PurchasableContext): Promise<ResolvedPurchasable | null> => {
    if (ref.sourceId !== ctx.userId) return null;
    const selected = new Set(selectedChargeIds(ref));
    const open = await loadOpenCharges(ctx.userId);
    const amountCents = open.filter((charge) => selected.has(charge.chargeId)).reduce((sum, charge) => sum + charge.remainingCents, 0);

    return {
      name: 'Account balance payment',
      description: 'Payment toward your studio account',
      href: `/profile/${ctx.userId}?tab=billing`,
      unitAmountCents: amountCents,
      categories: [],
      taxCode: NONTAXABLE_TAX_CODE,
      requiresShipping: false,
      maxQuantity: 1,
      excludeFromDiscounts: true,
      billing: { type: 'one_time' },
    };
  },

  // A charge that was voided or paid at the desk since this line went into the cart fails here, so
  // the family goes back to Billing rather than paying for something they no longer owe.
  validate: async (ref, _resolved, ctx) => {
    const selected = selectedChargeIds(ref);
    const open = new Set((await loadOpenCharges(ctx.userId)).map((charge) => charge.chargeId));
    if (selected.length === 0 || selected.some((chargeId) => !open.has(chargeId))) {
      return { ok: false, reason: 'Your balance has changed. Please go back to Billing on your profile and try again.' };
    }
    return { ok: true };
  },

  onPaid: recordLedgerBalancePayment,
};

export default ledgerBalancePurchasable;
