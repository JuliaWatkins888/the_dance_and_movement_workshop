import type { SettingDefinition } from './registry';

const appearanceSecondaryColorSetting: SettingDefinition = {
  key: 'appearance.secondaryColor',
  label: 'Secondary Color',
  description: 'The 500-intensity secondary brand color. The full 100-950 scale is regenerated from this hex.',
  group: 'Appearance',
  order: 41,
  type: 'color',
  default: '#397e7f',
};

export default appearanceSecondaryColorSetting;
