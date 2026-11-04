import type { CapabilityDefinition } from './registry';

const childrenManageCapability: CapabilityDefinition = {
  key: 'children:manage',
  label: 'Manage Students',
  description: 'View, create, edit, and delete any student and reassign its linked parent account.',
  group: 'Content',
  order: 16,
  defaultRoles: ['contributor', 'editor', 'admin'],
};

export default childrenManageCapability;
