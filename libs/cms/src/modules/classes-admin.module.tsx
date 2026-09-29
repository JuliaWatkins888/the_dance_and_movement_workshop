import type { CmsModule } from './registry';
import { ClassesAdminModule } from './classes/ClassesAdminModule';

const classesAdminModule: CmsModule = {
  id: 'classes',
  navLabel: 'Classes',
  icon: 'MusicNotes',
  requiredCapability: 'classes:manage',
  Component: ClassesAdminModule,
};

export default classesAdminModule;
