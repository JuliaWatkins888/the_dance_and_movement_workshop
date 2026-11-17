import type { CapabilityDefinition } from './registry';

const ledgerManageCapability: CapabilityDefinition = {
  key: 'ledger:manage',
  label: 'Manage Account Ledgers',
  description: 'See every family’s balance and ledger, add charges, record cash and check payments, void entries, and export payments.',
  group: 'Commerce',
  order: 45,
  defaultRoles: ['admin', 'editor'],
};

export default ledgerManageCapability;
