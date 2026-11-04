import type { CmsModule } from './registry';
import { ChildrenAdminModule } from './children/ChildrenAdminModule';

const childrenAdminModule: CmsModule = {
  id: 'children',
  navLabel: 'Students',
  icon: 'Baby',
  requiredCapability: 'children:manage',
  Component: ChildrenAdminModule,
};

export default childrenAdminModule;
