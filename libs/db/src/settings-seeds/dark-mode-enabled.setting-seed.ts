import type { UpsertSettingInput } from '../contracts/settings.contract';

const darkModeEnabledSettingSeed: UpsertSettingInput = {
  key: 'appearance.darkModeEnabled',
  type: 'boolean',
  value: false,
};

export default darkModeEnabledSettingSeed;
