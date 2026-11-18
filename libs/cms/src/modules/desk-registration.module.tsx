import type { CmsModule } from './registry';
import { DeskRegistrationModule } from './desk/DeskRegistrationModule';

const deskRegistrationModule: CmsModule = {
  id: 'front-desk',
  navLabel: 'Front Desk',
  icon: 'Storefront',
  requiredCapability: 'registrations:desk',
  Component: DeskRegistrationModule,
};

export default deskRegistrationModule;
