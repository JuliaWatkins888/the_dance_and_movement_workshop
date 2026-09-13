import { getDbProvider } from '@inithium/db';
import type { CreateNotificationInput, NotificationEntity } from '@inithium/db';
import { publishToUser } from '@inithium/realtime';

export const NOTIFICATION_EVENT = 'notification:new';

// The one place a notification is ever created in this system - persistence and real-time
// delivery happen together here, so no code path can create a notification without also pushing
// it to whichever devices the recipient currently has open. Any core route or future plugin (a
// friends system, a game) calls this exact function; it never touches @inithium/db's repository
// or @inithium/realtime's channel naming directly. Deliberately NOT re-exporting a bare "create"
// from @inithium/db itself - this is the only public "create".
export const createNotification = async (input: CreateNotificationInput): Promise<NotificationEntity> => {
  const notification = await getDbProvider().getNotificationRepository().create(input);
  await publishToUser(notification.userId, NOTIFICATION_EVENT, notification);
  return notification;
};

export {
  listNotificationsForUser,
  countUnreadNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsReadForUser,
  deleteNotificationForUser,
} from '@inithium/db';
export type { NotificationEntity, CreateNotificationInput } from '@inithium/db';
