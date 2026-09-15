import type { CapabilityDefinition } from './registry';

const childrenManageCapability: CapabilityDefinition = {
  key: 'children:manage',
  label: 'Manage Child Accounts',
  description: 'View, create, edit, and delete any child account and reassign its linked parent.',
  group: 'Content',
  order: 16,
  defaultRoles: ['contributor', 'editor', 'admin'],
};

export default childrenManageCapability;
