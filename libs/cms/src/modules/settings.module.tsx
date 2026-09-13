import type { CmsModule } from './registry';
import { SettingsModule } from './settings/SettingsModule';

const settingsModule: CmsModule = {
  id: 'settings',
  navLabel: 'Settings',
  icon: 'Gear',
  order: 30,
  requiredCapability: 'settings:manage',
  Component: SettingsModule,
};

export default settingsModule;
