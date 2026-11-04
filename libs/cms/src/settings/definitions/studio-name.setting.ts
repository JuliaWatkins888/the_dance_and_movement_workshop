import { DEFAULT_STUDIO_INFO } from '@inithium/api-client';
import type { SettingDefinition } from './registry';

const studioNameSetting: SettingDefinition = {
  key: 'studio.name',
  label: 'Studio Name',
  description: 'Shown as the location on events held at the studio.',
  group: 'Studio Info',
  order: 0,
  type: 'string',
  default: DEFAULT_STUDIO_INFO.name,
};

export default studioNameSetting;
