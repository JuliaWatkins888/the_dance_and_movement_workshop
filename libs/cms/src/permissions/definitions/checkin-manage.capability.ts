import type { CapabilityDefinition } from './registry';

const checkinManageCapability: CapabilityDefinition = {
  key: 'checkin:manage',
  label: 'Class Check-in',
  description: 'Open the Check-in screen, see who is in each class that day, and use or give back classes on adult class cards.',
  group: 'Commerce',
  order: 47,
  defaultRoles: ['contributor', 'editor', 'admin'],
};

export default checkinManageCapability;
