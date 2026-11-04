import { DEFAULT_STUDIO_INFO } from '@inithium/api-client';
import type { SettingDefinition } from './registry';

const studioEmailSetting: SettingDefinition = {
  key: 'studio.email',
  label: 'Email',
  description: 'Shown on the Contact page. Contact form notifications are set separately, under Contact.',
  group: 'Studio Info',
  order: 3,
  type: 'string',
  default: DEFAULT_STUDIO_INFO.email,
};

export default studioEmailSetting;
