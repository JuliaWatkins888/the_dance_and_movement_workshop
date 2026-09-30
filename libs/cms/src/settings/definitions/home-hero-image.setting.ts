import type { SettingDefinition } from './registry';

const homeHeroImageSetting: SettingDefinition = {
  key: 'home.heroImage',
  label: 'Home Page Image',
  description: 'The large image beside the welcome text on the home page. Until one is uploaded, the bundled image is used.',
  group: 'General',
  order: 2,
  type: 'image',
  default: { url: '' },
};

export default homeHeroImageSetting;
