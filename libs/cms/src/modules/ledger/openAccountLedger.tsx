import { dialog } from '@inithium/ui';
import { DIALOG_WIDTH_WIDE } from '../ecommerce/shared';
import { AccountLedgerPanel } from './AccountLedgerPanel';

export const openAccountLedger = (userId: string, name: string): void => {
  dialog.show(() => <AccountLedgerPanel userId={userId} />, { title: `Account: ${name}`, width: DIALOG_WIDTH_WIDE });
};
