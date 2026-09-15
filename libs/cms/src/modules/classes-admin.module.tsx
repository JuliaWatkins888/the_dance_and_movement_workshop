import type { CmsModule } from './registry';
import { ClassesAdminModule } from './classes/ClassesAdminModule';

const classesAdminModule: CmsModule = {
  id: 'classes',
  navLabel: 'Classes',
  icon: 'MusicNotes',
  order: 37,
  requiredCapability: 'classes:manage',
  Component: ClassesAdminModule,
};

export default classesAdminModule;
