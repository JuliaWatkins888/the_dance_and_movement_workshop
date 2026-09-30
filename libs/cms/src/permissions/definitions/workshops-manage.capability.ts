import type { CapabilityDefinition } from './registry';

const workshopsManageCapability: CapabilityDefinition = {
  key: 'workshops:manage',
  label: 'Manage Workshops',
  description: 'Create, edit, and delete one-off workshops and view who is registered.',
  group: 'Content',
  order: 17,
  defaultRoles: ['contributor', 'editor', 'admin'],
};

export default workshopsManageCapability;
