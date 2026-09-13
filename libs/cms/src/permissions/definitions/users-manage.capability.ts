import type { CapabilityDefinition } from './registry';

const usersManageCapability: CapabilityDefinition = {
  key: 'users:manage',
  label: 'Manage Users',
  description: 'Create, edit, and delete user accounts (not including permission grants).',
  group: 'System',
  order: 0,
  defaultRoles: ['admin'],
};

export default usersManageCapability;
