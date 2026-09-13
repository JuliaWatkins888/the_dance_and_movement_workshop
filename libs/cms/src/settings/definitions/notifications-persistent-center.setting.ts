import type { SettingDefinition } from './registry';

const notificationsPersistentCenterSetting: SettingDefinition = {
  key: 'notifications.showPersistentCenter',
  label: 'Persistent Notification Center',
  description: 'Always show the notification bell in the navbar, even when there are no unread notifications.',
  group: 'General',
  order: 10,
  type: 'boolean',
  default: false,
};

export default notificationsPersistentCenterSetting;
