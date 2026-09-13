import type { SettingDefinition } from './registry';

const darkModeEnabledSetting: SettingDefinition = {
  key: 'appearance.darkModeEnabled',
  label: 'Enable Dark Mode',
  description: 'Let users switch their own account to a dark color scheme. When off, dark mode is unavailable to everyone regardless of their personal preference.',
  group: 'General',
  order: 30,
  type: 'boolean',
  default: false,
};

export default darkModeEnabledSetting;
