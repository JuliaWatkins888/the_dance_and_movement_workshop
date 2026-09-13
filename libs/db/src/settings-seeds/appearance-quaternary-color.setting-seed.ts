import type { UpsertSettingInput } from '../contracts/settings.contract';

const appearanceQuaternaryColorSettingSeed: UpsertSettingInput = {
  key: 'appearance.quaternaryColor',
  type: 'color',
  value: '#25374f',
};

export default appearanceQuaternaryColorSettingSeed;
