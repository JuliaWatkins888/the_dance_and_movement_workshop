import type { SettingDefinition } from './registry';

const appNameSetting: SettingDefinition = {
  key: 'app.name',
  label: 'Application Name',
  description: 'Displayed in the site navbar and browser tab.',
  group: 'General',
  order: 0,
  type: 'string',
  default: 'Inithium',
};

export default appNameSetting;
