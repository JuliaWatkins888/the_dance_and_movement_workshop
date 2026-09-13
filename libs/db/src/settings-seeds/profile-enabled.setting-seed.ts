import type { UpsertSettingInput } from '../contracts/settings.contract';

const profileEnabledSettingSeed: UpsertSettingInput = {
  key: 'profile.enabled',
  type: 'boolean',
  value: true,
};

export default profileEnabledSettingSeed;
