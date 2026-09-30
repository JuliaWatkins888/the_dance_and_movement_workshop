import type { CapabilityDefinition } from './registry';

const eventsManageCapability: CapabilityDefinition = {
  key: 'events:manage',
  label: 'Manage Events',
  description: 'Create, edit, and delete ticketed events such as recitals.',
  group: 'Content',
  order: 18,
  defaultRoles: ['contributor', 'editor', 'admin'],
};

export default eventsManageCapability;
