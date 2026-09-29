import type { CmsModule } from './registry';
import { PoliciesAdminModule } from './policies/PoliciesAdminModule';

const policiesAdminModule: CmsModule = {
  id: 'policies',
  navLabel: 'Policies',
  icon: 'ClipboardText',
  requiredCapability: 'policies:manage',
  Component: PoliciesAdminModule,
};

export default policiesAdminModule;
