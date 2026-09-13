import type { CapabilityDefinition } from './registry';

const pagesManageCapability: CapabilityDefinition = {
  key: 'pages:manage',
  label: 'Manage Pages',
  description: 'Create, edit, and configure site pages.',
  group: 'Content',
  order: 10,
  defaultRoles: ['editor', 'admin'],
};

export default pagesManageCapability;
