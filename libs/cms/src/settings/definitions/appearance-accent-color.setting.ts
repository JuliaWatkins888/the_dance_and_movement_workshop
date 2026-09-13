import type { SettingDefinition } from './registry';

const appearanceAccentColorSetting: SettingDefinition = {
  key: 'appearance.accentColor',
  label: 'Accent Color',
  description: 'The 500-intensity accent color, used for stark-contrast interaction states (hover, focus rings). The full 100-950 scale is regenerated from this hex.',
  group: 'Appearance',
  order: 44,
  type: 'color',
  default: '#f5a42d',
};

export default appearanceAccentColorSetting;
