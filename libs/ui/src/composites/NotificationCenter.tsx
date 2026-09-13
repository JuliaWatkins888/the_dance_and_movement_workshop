import type { NotificationEntity } from '@inithium/db';
import { Box, Button, Icon, IconButton, Text } from '../components';
import { drawer } from '../drawer/drawer';
import type { DrawerRenderContext } from '../drawer/drawerStore';
import { mergeClassNames } from '../theme/mergeClassNames';

export interface NotificationCenterProps {
  // Recent notifications (read + unread mixed, newest first) - the host resolves these via
  // @inithium/api-client's useNotificationCenter and passes the plain result down.
  readonly notifications: NotificationEntity[];
  readonly unreadCount: number;
  // When true, the bell stays visible even with zero unread notifications (backed by the CMS's
  // "Persistent Notification Center" global setting) - when false/omitted, legacy behavior
  // applies: the bell only appears while there's at least one unread notification.
  readonly showPersistent?: boolean;
  readonly onNotificationClick?: (notification: NotificationEntity) => void;
  readonly onMarkAllRead?: () => void;
  readonly onDelete?: (id: string) => void;
}

const NotificationPreviewItem = ({
  notification,
  onClick,
  onDelete,
}: {
  notification: NotificationEntity;
  onClick: () => void;
  onDelete?: () => void;
}) => (
  <Box
    flex={{ direction: 'row', align: 'start', gap: 4 }}
    className={mergeClassNames('w-full rounded-md', !notification.isRead && 'bg-surface-100')}
  >
    <Button
      variant={{ kind: 'ghost', color: 'surface' }}
      onClick={onClick}
      className="h-auto flex-1 flex-col items-start gap-1 p-3 text-left"
    >
      <Box flex={{ direction: 'row', align: 'center', gap: 8 }} className="w-full">
        <Text as="span" className="font-medium">
          {notification.title}
        </Text>
        {!notification.isRead ? (
          <span aria-hidden="true" className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary-500" />
        ) : null}
      </Box>
      {notification.body ? (
        <Text as="p" className="text-sm text-surface-700">
          {notification.body}
        </Text>
      ) : null}
    </Button>
    {onDelete ? (
      <IconButton
        icon="Trash"
        label={`Delete notification: ${notification.title}`}
        textColor={{ color: 'surface', intensity: 500 }}
        iconSize={16}
        onClick={onDelete}
        className="mt-3 shrink-0"
      />
    ) : null}
  </Box>
);

const NotificationCenterContent = ({
  notifications,
  onNotificationClick,
  onMarkAllRead,
  onDelete,
  close,
}: {
  notifications: NotificationEntity[];
  onNotificationClick?: (notification: NotificationEntity) => void;
  onMarkAllRead?: () => void;
  onDelete?: (id: string) => void;
  close: () => void;
}) => (
  <Box flex={{ direction: 'col', gap: 8 }} className="min-h-0 flex-1">
    {onMarkAllRead ? (
      <Button variant={{ kind: 'link', color: 'accent' }} className="self-end" onClick={onMarkAllRead}>
        Mark all as read
      </Button>
    ) : null}
    {notifications.length === 0 ? (
      <Text as="p" className="text-surface-950">
        You&apos;re all caught up.
      </Text>
    ) : (
      notifications.map((notification) => (
        <NotificationPreviewItem
          key={notification.id}
          notification={notification}
          onClick={() => {
            onNotificationClick?.(notification);
            close();
          }}
          onDelete={onDelete ? () => onDelete(notification.id) : undefined}
        />
      ))
    )}
  </Box>
);

// The bell button + badge + slide-in drawer, as one embeddable unit - shared by the public
// Navbar and the CMS's own navbar rather than each maintaining its own copy.
export const NotificationCenter = ({
  notifications,
  unreadCount,
  showPersistent = false,
  onNotificationClick,
  onMarkAllRead,
  onDelete,
}: NotificationCenterProps) => {
  const openNotificationsDrawer = () => {
    drawer.show(
      ({ close }: DrawerRenderContext) => (
        <NotificationCenterContent
          notifications={notifications}
          onNotificationClick={onNotificationClick}
          onMarkAllRead={onMarkAllRead}
          onDelete={onDelete}
          close={close}
        />
      ),
      { side: 'right', title: 'Notifications' },
    );
  };

  if (!showPersistent && unreadCount === 0) return null;

  return (
    <span className="relative inline-block">
      <Button
        variant={{ kind: 'ghost', color: 'surface' }}
        padding={{ base: 0 }}
        onClick={openNotificationsDrawer}
        aria-label={`Open notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Icon name="Bell" size={22} />
      </Button>
      {unreadCount > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium leading-none text-white"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </span>
  );
};
