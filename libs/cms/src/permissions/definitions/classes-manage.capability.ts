import type { CapabilityDefinition } from './registry';

const classesManageCapability: CapabilityDefinition = {
  key: 'classes:manage',
  label: 'Manage Classes',
  description: 'Create, edit, and delete dance and movement class offerings.',
  group: 'Content',
  order: 16,
  defaultRoles: ['contributor', 'editor', 'admin'],
};

export default classesManageCapability;
