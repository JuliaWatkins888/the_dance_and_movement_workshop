import type { CapabilityDefinition } from './registry';

const registrationsDeskCapability: CapabilityDefinition = {
  key: 'registrations:desk',
  label: 'Front Desk Registration',
  description:
    'Register families from the CMS: create accounts and students, enroll them in classes and workshops, take a card or put it on their account, and withdraw monthly classes.',
  group: 'Commerce',
  order: 46,
  defaultRoles: ['admin', 'editor'],
};

export default registrationsDeskCapability;
