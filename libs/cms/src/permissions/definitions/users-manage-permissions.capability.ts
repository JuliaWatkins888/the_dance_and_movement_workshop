import type { CapabilityDefinition } from './registry';

const usersManagePermissionsCapability: CapabilityDefinition = {
  key: 'users:managePermissions',
  label: 'Manage Permissions',
  description:
    "Edit other users' roles and individual capability grants. Deliberately excluded from every " +
    'role default, including Admin - granting this is a different trust tier than any other ' +
    'capability, so it only ever exists as an explicit, owner-granted override.',
  group: 'System',
  order: 1,
  defaultRoles: [],
};

export default usersManagePermissionsCapability;
