import type { CapabilityDefinition } from './registry';

const policiesManageCapability: CapabilityDefinition = {
  key: 'policies:manage',
  label: 'Manage Policies',
  description: 'Create, edit, and delete studio policy categories and their content.',
  group: 'Content',
  order: 15,
  defaultRoles: ['contributor', 'editor', 'admin'],
};

export default policiesManageCapability;
