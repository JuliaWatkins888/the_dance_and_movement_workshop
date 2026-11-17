import type { CmsModule } from './registry';
import { LedgerAdminModule } from './ledger/LedgerAdminModule';

const ledgerAdminModule: CmsModule = {
  id: 'accounts',
  navLabel: 'Accounts',
  icon: 'Wallet',
  requiredCapability: 'ledger:manage',
  Component: LedgerAdminModule,
};

export default ledgerAdminModule;
