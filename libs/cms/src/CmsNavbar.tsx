import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Box, Button, NotificationCenter, Text, drawer, resolveAvatarConfigProps } from '@inithium/ui';
import type { DrawerRenderContext } from '@inithium/ui';
import { useAppName, useNotificationCenter, useShowPersistentNotificationCenter } from '@inithium/api-client';
import type { AuthUser } from '@inithium/api-client';

export interface CmsNavbarProps {
  readonly currentUser: AuthUser;
  readonly onLogout: () => void;
}

const CmsAccountDrawerContent = ({
  currentUser,
  onLogout,
  close,
}: {
  currentUser: AuthUser;
  onLogout: () => void;
  close: () => void;
}) => (
  <Box flex={{ direction: 'col', gap: 16 }} className="min-h-0 flex-1">
    <Text as="p" className="text-sm text-surface-600">
      {currentUser.email}
    </Text>
    <Box className="mt-auto" padding={{ top: 16 }}>
      <Button
        variant={{ kind: 'filled', color: 'red' }}
        className="w-full"
        onClick={() => {
          onLogout();
          close();
        }}
      >
        Logout
      </Button>
    </Box>
  </Box>
);

// The CMS shell's own top navbar - mirrors the public app's Navbar for logo/title, and embeds
// the same shared NotificationCenter (@inithium/ui) an admin/editor's notifications flow through
// (including ones plugins like the Blog module push), plus an avatar-triggered logout drawer.
export const CmsNavbar = ({ currentUser, onLogout }: CmsNavbarProps) => {
  const appName = useAppName();
  const navigate = useNavigate();
  const showPersistent = useShowPersistentNotificationCenter();
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotificationCenter(
    currentUser.id,
  );

  const openAccountDrawer = () => {
    drawer.show(
      ({ close }: DrawerRenderContext) => (
        <CmsAccountDrawerContent currentUser={currentUser} onLogout={onLogout} close={close} />
      ),
      { side: 'right', title: 'Account' },
    );
  };

  return (
    <Box
      as="header"
      flex={{ direction: 'row', justify: 'between', align: 'center' }}
      bgColor={{ color: 'surface', intensity: 100 }}
      borderColor={{ color: 'surface', intensity: 300 }}
      padding={{ left: 24, right: 24 }}
      className="h-16 w-full shrink-0 border-b"
    >
      <Link to="/cms" className="flex shrink-0 items-center gap-2">
        <Text textColor={{ color: 'surface', intensity: 950 }} as="span" className="text-lg font-semibold font-primary">
          {appName}
        </Text>
      </Link>

      <Box flex={{ direction: 'row', align: 'center', gap: 16 }}>
        <NotificationCenter
          notifications={notifications}
          unreadCount={unreadCount}
          showPersistent={showPersistent}
          onNotificationClick={(notification) => {
            markAsRead(notification.id);
            if (notification.actionUrl) navigate(notification.actionUrl);
          }}
          onMarkAllRead={markAllAsRead}
          onDelete={removeNotification}
        />
        <Avatar
          {...resolveAvatarConfigProps(
            currentUser.avatar,
            [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' '),
          )}
          size={36}
          onClick={openAccountDrawer}
        />
      </Box>
    </Box>
  );
};
