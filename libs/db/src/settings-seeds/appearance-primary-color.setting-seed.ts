import type { UpsertSettingInput } from '../contracts/settings.contract';

// Mirrors theme.css's static --ui-primary-500 default - seeding it explicitly (rather than
// leaving the setting unset) is what makes a fresh project's settings collection match core's
// own out of the box, instead of relying on every consumer's in-code fallback staying in sync by
// hand. An admin can still override it later from the CMS's Appearance settings (if the cms
// plugin is installed) exactly as before - seeding never blocks a later upsert.
const appearancePrimaryColorSettingSeed: UpsertSettingInput = {
  key: 'appearance.primaryColor',
  type: 'color',
  value: '#006a8e',
};

export default appearancePrimaryColorSettingSeed;
