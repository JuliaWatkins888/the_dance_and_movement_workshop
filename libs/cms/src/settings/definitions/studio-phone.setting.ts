import { DEFAULT_STUDIO_INFO } from '@inithium/api-client';
import type { SettingDefinition } from './registry';

const studioPhoneSetting: SettingDefinition = {
  key: 'studio.phone',
  label: 'Phone',
  description: 'Shown on the Contact page exactly as typed here, and tapping it calls this number.',
  group: 'Studio Info',
  order: 2,
  type: 'string',
  default: DEFAULT_STUDIO_INFO.phone,
};

export default studioPhoneSetting;
