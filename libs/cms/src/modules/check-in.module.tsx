import type { CmsModule } from './registry';
import { CheckInModule } from './check-in/CheckInModule';

const checkInModule: CmsModule = {
  id: 'check-in',
  navLabel: 'Check-in',
  icon: 'CheckSquare',
  requiredCapability: 'checkin:manage',
  Component: CheckInModule,
};

export default checkInModule;
