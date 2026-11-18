// An order's payment.provider when no card provider took the money.
// manual - staff recorded a purchase that was already paid outside the system
// ledger - staff registered a family who pays in person: the amount is owed on the account ledger
export const MANUAL_PAYMENT_PROVIDER = 'manual';
export const LEDGER_PAYMENT_PROVIDER = 'ledger';
