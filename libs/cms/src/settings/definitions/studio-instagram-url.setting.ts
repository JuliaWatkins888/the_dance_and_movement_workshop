import { DEFAULT_STUDIO_INFO } from '@inithium/api-client';
import type { SettingDefinition } from './registry';

const studioInstagramUrlSetting: SettingDefinition = {
  key: 'studio.instagramUrl',
  label: 'Instagram Link',
  description: 'The full https:// link. Leave blank to hide the Instagram icon.',
  group: 'Studio Info',
  order: 5,
  type: 'string',
  default: DEFAULT_STUDIO_INFO.instagramUrl,
};

export default studioInstagramUrlSetting;
