import type { SettingDefinition } from './registry';

const appearanceTertiaryColorSetting: SettingDefinition = {
  key: 'appearance.tertiaryColor',
  label: 'Tertiary Color',
  description: 'The 500-intensity tertiary brand color. The full 100-950 scale is regenerated from this hex.',
  group: 'Appearance',
  order: 42,
  type: 'color',
  default: '#64748b',
};

export default appearanceTertiaryColorSetting;
