import type { CmsModule } from './registry';
import { PrivateLessonsModule } from './private-lessons/PrivateLessonsModule';

const privateLessonsAdminModule: CmsModule = {
  id: 'private-lessons',
  navLabel: 'Private Lessons',
  icon: 'Student',
  requiredCapability: 'privates:manage',
  Component: PrivateLessonsModule,
};

export default privateLessonsAdminModule;
