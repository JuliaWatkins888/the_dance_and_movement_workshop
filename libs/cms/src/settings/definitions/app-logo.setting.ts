import type { SettingDefinition } from './registry';

const appLogoSetting: SettingDefinition = {
  key: 'app.logo',
  label: 'Logo',
  description: 'Shown in the site navbar and used as the browser tab icon. Until one is uploaded, the bundled logo is used.',
  group: 'General',
  order: 1,
  type: 'image',
  default: { url: '' },
};

export default appLogoSetting;
