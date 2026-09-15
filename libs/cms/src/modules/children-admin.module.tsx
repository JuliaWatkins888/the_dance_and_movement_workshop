import type { CmsModule } from './registry';
import { ChildrenAdminModule } from './children/ChildrenAdminModule';

const childrenAdminModule: CmsModule = {
  id: 'children',
  navLabel: 'Child Accounts',
  icon: 'Baby',
  order: 38,
  requiredCapability: 'children:manage',
  Component: ChildrenAdminModule,
};

export default childrenAdminModule;
