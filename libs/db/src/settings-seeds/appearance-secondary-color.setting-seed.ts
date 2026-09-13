import type { UpsertSettingInput } from '../contracts/settings.contract';

const appearanceSecondaryColorSettingSeed: UpsertSettingInput = {
  key: 'appearance.secondaryColor',
  type: 'color',
  value: '#397e7f',
};

export default appearanceSecondaryColorSettingSeed;
