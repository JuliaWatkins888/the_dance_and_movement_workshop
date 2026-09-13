import type { UpsertSettingInput } from '../contracts/settings.contract';

const appearanceTertiaryColorSettingSeed: UpsertSettingInput = {
  key: 'appearance.tertiaryColor',
  type: 'color',
  value: '#64748b',
};

export default appearanceTertiaryColorSettingSeed;
