import { DEFAULT_STUDIO_INFO } from '@inithium/api-client';
import type { SettingDefinition } from './registry';

const studioHoursSetting: SettingDefinition = {
  key: 'studio.hours',
  label: 'Hours',
  description:
    'Type anything for a day, like "3:00 PM – 8:30 PM", "Closed" or "By Appointment Only". A link is optional and makes that day\'s text clickable: /contact?subject=Private%20lesson opens the contact form with the subject filled in.',
  group: 'Studio Info',
  order: 6,
  type: 'json',
  editor: 'studioHours',
  default: { days: DEFAULT_STUDIO_INFO.hours },
};

export default studioHoursSetting;
