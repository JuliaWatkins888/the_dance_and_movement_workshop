import type { CapabilityDefinition } from './registry';

const calendarManageCapability: CapabilityDefinition = {
  key: 'calendar:manage',
  label: 'Manage Calendar',
  description: 'Add studio closures and other calendar entries, and choose which holidays the studio is open.',
  group: 'Content',
  order: 19,
  defaultRoles: ['contributor', 'editor', 'admin'],
};

export default calendarManageCapability;
