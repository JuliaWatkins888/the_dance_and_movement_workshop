import { DEFAULT_STUDIO_INFO } from '@inithium/api-client';
import type { SettingDefinition } from './registry';

const studioFacebookUrlSetting: SettingDefinition = {
  key: 'studio.facebookUrl',
  label: 'Facebook Link',
  description: 'The full https:// link. Leave blank to hide the Facebook icon.',
  group: 'Studio Info',
  order: 4,
  type: 'string',
  default: DEFAULT_STUDIO_INFO.facebookUrl,
};

export default studioFacebookUrlSetting;
