import type { CmsModule } from './registry';
import { StaffAdminModule } from './staff/StaffAdminModule';

const staffAdminModule: CmsModule = {
  id: 'staff',
  navLabel: 'Staff',
  icon: 'IdentificationCard',
  requiredCapability: 'staff:manage',
  Component: StaffAdminModule,
};

export default staffAdminModule;
