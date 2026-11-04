import { DEFAULT_STUDIO_INFO } from '@inithium/api-client';
import type { SettingDefinition } from './registry';

const studioAddressSetting: SettingDefinition = {
  key: 'studio.address',
  label: 'Address',
  description: 'Shown on the Contact page and map, and on events held at the studio.',
  group: 'Studio Info',
  order: 1,
  type: 'string',
  default: DEFAULT_STUDIO_INFO.address,
};

export default studioAddressSetting;
