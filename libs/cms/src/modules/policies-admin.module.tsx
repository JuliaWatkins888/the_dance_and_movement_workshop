import type { CmsModule } from './registry';
import { PoliciesAdminModule } from './policies/PoliciesAdminModule';

const policiesAdminModule: CmsModule = {
  id: 'policies',
  navLabel: 'Policies',
  icon: 'ClipboardText',
  order: 36,
  requiredCapability: 'policies:manage',
  Component: PoliciesAdminModule,
};

export default policiesAdminModule;
