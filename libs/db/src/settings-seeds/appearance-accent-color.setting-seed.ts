import type { UpsertSettingInput } from '../contracts/settings.contract';

const appearanceAccentColorSettingSeed: UpsertSettingInput = {
  key: 'appearance.accentColor',
  type: 'color',
  value: '#f5a42d',
};

export default appearanceAccentColorSettingSeed;
