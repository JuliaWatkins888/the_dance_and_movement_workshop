import type { SettingDefinition } from './registry';

const appearanceQuaternaryColorSetting: SettingDefinition = {
  key: 'appearance.quaternaryColor',
  label: 'Quaternary Color',
  description: 'The 500-intensity quaternary brand color. The full 100-950 scale is regenerated from this hex.',
  group: 'Appearance',
  order: 43,
  type: 'color',
  default: '#25374f',
};

export default appearanceQuaternaryColorSetting;
