import type { CapabilityDefinition } from './registry';

const storageManageAssetsCapability: CapabilityDefinition = {
  key: 'storage:manageAssets',
  label: 'Manage Storage Assets',
  description: "Delete other users' uploaded assets (your own uploads can always be deleted).",
  group: 'System',
  order: 3,
  defaultRoles: ['editor', 'admin'],
};

export default storageManageAssetsCapability;
