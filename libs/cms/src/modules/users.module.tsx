import type { CmsModule } from './registry';
import { UsersModule } from './users/UsersModule';

const usersModule: CmsModule = {
  id: 'users',
  navLabel: 'Users',
  icon: 'Users',
  order: 10,
  requiredCapability: 'users:manage',
  Component: UsersModule,
};

export default usersModule;
