import type { SettingDefinition } from './registry';

// Default mirrors theme.css's static --ui-primary-500 - the color this setting overrides once an
// admin actually saves one, so the field starts pre-filled with what the app already looks like.
const appearancePrimaryColorSetting: SettingDefinition = {
  key: 'appearance.primaryColor',
  label: 'Primary Color',
  description: 'The 500-intensity primary brand color. The full 100-950 scale is regenerated from this hex.',
  group: 'Appearance',
  order: 40,
  type: 'color',
  default: '#006a8e',
};

export default appearancePrimaryColorSetting;
