import type { CapabilityDefinition } from './registry';

const galleryManageCapability: CapabilityDefinition = {
  key: 'gallery:manage',
  label: 'Manage Gallery',
  description: 'Upload, edit, and delete gallery images.',
  group: 'Content',
  order: 13,
  defaultRoles: ['contributor', 'editor', 'admin'],
};

export default galleryManageCapability;
