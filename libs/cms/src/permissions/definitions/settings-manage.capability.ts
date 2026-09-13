import type { CapabilityDefinition } from './registry';

const settingsManageCapability: CapabilityDefinition = {
  key: 'settings:manage',
  label: 'Manage Settings',
  description: 'View and change site-wide settings.',
  group: 'System',
  order: 2,
  defaultRoles: ['admin'],
};

export default settingsManageCapability;
