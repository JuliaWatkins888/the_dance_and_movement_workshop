import type { UpsertSettingInput } from '../contracts/settings.contract';

const appearanceSurfaceColorSettingSeed: UpsertSettingInput = {
  key: 'appearance.surfaceColor',
  type: 'color',
  value: '#94a3b8',
};

export default appearanceSurfaceColorSettingSeed;
