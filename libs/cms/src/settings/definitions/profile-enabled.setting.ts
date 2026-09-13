import type { SettingDefinition } from './registry';

const profileEnabledSetting: SettingDefinition = {
  key: 'profile.enabled',
  label: 'Enable User Profiles',
  description: 'Let users view profile pages (/profile/:id) and self-edit their name/email. When off, users can still change their password from the navbar menu.',
  group: 'General',
  order: 20,
  type: 'boolean',
  default: true,
};

export default profileEnabledSetting;
