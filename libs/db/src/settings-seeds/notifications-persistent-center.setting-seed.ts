import type { UpsertSettingInput } from '../contracts/settings.contract';

const notificationsPersistentCenterSettingSeed: UpsertSettingInput = {
  key: 'notifications.showPersistentCenter',
  type: 'boolean',
  value: false,
};

export default notificationsPersistentCenterSettingSeed;
