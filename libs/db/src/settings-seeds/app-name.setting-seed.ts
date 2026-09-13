import type { UpsertSettingInput } from '../contracts/settings.contract';

const appNameSettingSeed: UpsertSettingInput = {
  key: 'app.name',
  type: 'string',
  value: 'Inithium',
};

export default appNameSettingSeed;
