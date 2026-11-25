import type { CapabilityDefinition } from './registry';

const privatesManageCapability: CapabilityDefinition = {
  key: 'privates:manage',
  label: 'Private Lessons',
  description:
    'Set up recurring and one-off private lessons, see every instructor’s private lesson schedule with student names, and cancel or move single lessons. Each lesson taught is charged to the family’s account.',
  group: 'Commerce',
  order: 48,
  defaultRoles: ['admin', 'editor'],
};

export default privatesManageCapability;
