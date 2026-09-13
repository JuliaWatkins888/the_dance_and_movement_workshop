import type { CapabilityDefinition } from './registry';

const staffManageCapability: CapabilityDefinition = {
  key: 'staff:manage',
  label: 'Manage Staff',
  description: 'Create, edit, and delete staff member profiles.',
  group: 'Content',
  order: 14,
  defaultRoles: ['contributor', 'editor', 'admin'],
};

export default staffManageCapability;
