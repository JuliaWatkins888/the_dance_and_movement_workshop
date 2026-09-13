import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Box, Button, Tabs, TabsContent, TabsList, TabsTrigger, Text, drawer, resolveAvatarConfigProps } from '@inithium/ui';
import type { DrawerRenderContext } from '@inithium/ui';
import type { AuthUser } from '@inithium/api-client';
import { TimeCurrentUserProvider, canAccessTimeResource } from './TimeCurrentUserContext';
import { MyTimePanel } from './myTime/MyTimePanel';
import { ReviewPanel } from './review/ReviewPanel';
import { SettingsPanel } from './settings/SettingsPanel';

export interface TimeShellProps {
  readonly currentUser: AuthUser;
  readonly onLogout: () => void;
}

const TimeAccountDrawerContent = ({ currentUser, onLogout, close }: { currentUser: AuthUser; onLogout: () => void; close: () => void }) => (
  <Box flex={{ direction: 'col', gap: 16 }} className="min-h-0 flex-1">
    <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
      {currentUser.email}
    </Text>
    <Link to="/" onClick={close}>
      <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm hover:underline">
        Back to site
      </Text>
    </Link>
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

// Local useState for the active tab rather than nested react-router routes - unlike @inithium/cms's
// dynamic, plugin-discoverable module list, this area only ever has three fixed sections, so the
// extra routing layer CMS needs would be unused complexity here.
export const TimeShell = ({ currentUser, onLogout }: TimeShellProps) => {
  const canTrack = canAccessTimeResource(currentUser, 'time:track');
  const canManage = canAccessTimeResource(currentUser, 'time:manage');
  const [activeTab, setActiveTab] = useState(canTrack ? 'my-time' : 'review');

  const openAccountDrawer = () => {
    drawer.show(
      ({ close }: DrawerRenderContext) => <TimeAccountDrawerContent currentUser={currentUser} onLogout={onLogout} close={close} />,
      { side: 'right', title: 'Account' },
    );
  };

  return (
    <TimeCurrentUserProvider value={currentUser}>
      <Box flex={{ direction: 'col' }} bgColor={{ color: 'surface', intensity: 100 }} className="h-screen w-full overflow-hidden">
        <Box
          as="header"
          flex={{ direction: 'row', justify: 'between', align: 'center' }}
          bgColor={{ color: 'surface', intensity: 100 }}
          borderColor={{ color: 'surface', intensity: 300 }}
          padding={{ left: 24, right: 24 }}
          className="h-16 w-full shrink-0 border-b"
        >
          <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-semibold">
            Time Clock
          </Text>
          <Avatar
            {...resolveAvatarConfigProps(currentUser.avatar, [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' '))}
            size={36}
            onClick={openAccountDrawer}
          />
        </Box>

        <Box className="min-h-0 flex-1 overflow-y-auto" padding={{ base: 24 }}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              {canTrack ? <TabsTrigger value="my-time">My Time</TabsTrigger> : null}
              {canManage ? <TabsTrigger value="review">Review</TabsTrigger> : null}
              {canManage ? <TabsTrigger value="settings">Settings</TabsTrigger> : null}
            </TabsList>

            {canTrack ? (
              <TabsContent value="my-time">
                <MyTimePanel />
              </TabsContent>
            ) : null}
            {canManage ? (
              <TabsContent value="review">
                <ReviewPanel />
              </TabsContent>
            ) : null}
            {canManage ? (
              <TabsContent value="settings">
                <SettingsPanel />
              </TabsContent>
            ) : null}
          </Tabs>
        </Box>
      </Box>
    </TimeCurrentUserProvider>
  );
};
