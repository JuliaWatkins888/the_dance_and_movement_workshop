import type { CmsModule } from './registry';
import { CommunicationsAdminModule } from './communications/CommunicationsAdminModule';

const communicationsAdminModule: CmsModule = {
  id: 'communications',
  navLabel: 'Communications',
  icon: 'Envelope',
  requiredCapability: 'contact:manageThreads',
  Component: CommunicationsAdminModule,
};

export default communicationsAdminModule;
