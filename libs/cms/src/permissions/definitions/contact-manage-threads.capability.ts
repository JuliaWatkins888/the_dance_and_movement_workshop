import type { CapabilityDefinition } from './registry';

const contactManageThreadsCapability: CapabilityDefinition = {
  key: 'contact:manageThreads',
  label: 'Manage Contact Threads',
  description: 'View, reply to, and delete contact-form message threads.',
  group: 'Communications',
  order: 20,
  defaultRoles: ['editor', 'admin'],
};

export default contactManageThreadsCapability;
