import type { CmsModule } from './registry';
import { PermissionsModule } from './permissions/PermissionsModule';

const permissionsModule: CmsModule = {
  id: 'permissions',
  navLabel: 'Permissions',
  icon: 'ShieldCheck',
  order: 15,
  // Not role-bundled by default (see users-manage-permissions.capability.ts) - only the owner,
  // or someone individually granted this override, ever sees this module at all.
  requiredCapability: 'users:managePermissions',
  Component: PermissionsModule,
};

export default permissionsModule;
