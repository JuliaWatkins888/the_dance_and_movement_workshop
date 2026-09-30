import type { CmsModule } from './registry';
import { WorkshopsAdminModule } from './workshops/WorkshopsAdminModule';

const workshopsAdminModule: CmsModule = {
  id: 'workshops',
  navLabel: 'Workshops',
  icon: 'CalendarStar',
  requiredCapability: 'workshops:manage',
  Component: WorkshopsAdminModule,
};

export default workshopsAdminModule;
