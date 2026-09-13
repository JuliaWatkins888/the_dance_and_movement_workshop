import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertContainer,
  Box,
  DialogContainer,
  DrawerContainer,
  Footer,
  Navbar,
  PageShell,
  Loader,
  alert,
  useNavigateWithTransition,
} from '@inithium/ui';
import {
  useAppName,
  useGetNavPagesQuery,
  useGetPageByRouteQuery,
  useIsProfileEnabled,
  useNotificationCenter,
  useRealtimeConnectionStatus,
  useShowPersistentNotificationCenter,
} from '@inithium/api-client';
import { useCurrentUser, useAuthToken } from './useCurrentUser';
import { RealtimeConnectionBoundary } from './RealtimeConnectionBoundary';
import { useResolvedNotificationHooks } from './notificationHooks/registry';
import { pageComponents } from '../pages/pageComponents';
import { NotFoundPage } from '../pages/NotFoundPage';
import { useOpenChangePasswordDialog } from '../pages/profile/openChangePasswordDialog';
// inithium:anchor:imports

// Kept in one place and passed to both Navbar (`height`) and PageShell (`navbarHeight`) so the
// two composites' sizing always stays in sync.
const NAVBAR_HEIGHT = 64;

// Routing here is entirely data-driven: react-router-dom only supplies history/location, not
// <Route> elements — every path change re-resolves the current Page record from the backend
// via useGetPageByRouteQuery, and PageShell maps its slug to the matching test page component.
export function App() {
  const location = useLocation();
  const route = `${location.pathname}${location.search}`;
  const navigate = useNavigateWithTransition();

  const { data: page, isLoading: isPageLoading } = useGetPageByRouteQuery({ route });
  const { data: primaryNavPages = [], isLoading: isPrimaryNavLoading } = useGetNavPagesQuery('primary-nav');
  const { data: profileNavPages = [], isLoading: isProfileNavLoading } = useGetNavPagesQuery('profile-nav');
  const { data: primaryFooterPages = [], isLoading: isPrimaryFooterLoading } = useGetNavPagesQuery('primary-footer');
  const { data: secondaryFooterPages = [], isLoading: isSecondaryFooterLoading } = useGetNavPagesQuery('secondary-footer');
  const { currentUser, isResolving: isAuthResolving, logout } = useCurrentUser();
  const token = useAuthToken();
  const realtimeStatus = useRealtimeConnectionStatus();
  // Backed by the CMS plugin's app.name setting when installed (falls back to "Inithium"
  // otherwise or before anything's ever been saved) - see @inithium/api-client's useAppName.
  const appName = useAppName();
  const showPersistentNotificationCenter = useShowPersistentNotificationCenter();
  const profileEnabled = useIsProfileEnabled();
  const openChangePasswordDialog = useOpenChangePasswordDialog();
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotificationCenter(currentUser?.id, {
    onNotification: (notification) => {
      alert.show(notification.title, {
        position: 'bottom-right',
        severity: 'notification',
        animation: { entrance: 'animate__fadeInRight', exit: 'animate__fadeOutRight' },
      });
    },
  });
  const resolvedNotificationHooks = useResolvedNotificationHooks();

  useEffect(() => {
    document.title = appName;
  }, [appName]);

  // Gates the very first render of the real shell on everything it depends on: auth resolving
  // (so the Navbar never flashes logged-out right before a stored token resolves into a real
  // session), the realtime socket finishing its first connection attempt (open OR closed - not
  // "still connecting", but not blocking forever through an outage's reconnect loop either), and
  // the nav/footer/page data the shell itself renders. Latched via the effect below so a later
  // reconnect or route change never brings the full-screen loader back once the app has actually
  // started - this is a one-time bootstrap gate, not a persistent loading state.
  const isBootstrapDataReady =
    !isAuthResolving &&
    (!token || realtimeStatus === 'open' || realtimeStatus === 'closed') &&
    !isPageLoading &&
    !isPrimaryNavLoading &&
    !isProfileNavLoading &&
    !isPrimaryFooterLoading &&
    !isSecondaryFooterLoading;

  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  useEffect(() => {
    if (isBootstrapDataReady) setHasBootstrapped(true);
  }, [isBootstrapDataReady]);

  // inithium:anchor:before-return

  return (
    // The absolute top-level container: a near-black backdrop so the (mostly slate-100/surface)
    // pages have real contrast to fade or slide against — without this, a page fading toward
    // transparent (or sliding out) reveals nothing but a plain white gap instead of a visible
    // transition.
    <Box bgColor={{ color: 'surface', intensity: 950 }} className="min-h-screen w-full">
      {hasBootstrapped ? (
        <>
          <Navbar
            primaryNavPages={primaryNavPages}
            profileNavPages={profileNavPages}
            currentUser={currentUser}
            notifications={notifications}
            unreadNotificationCount={unreadCount}
            showPersistentNotificationCenter={showPersistentNotificationCenter}
            profileEnabled={profileEnabled}
            onChangePasswordClick={openChangePasswordDialog}
            onNotificationClick={(notification) => {
              markAsRead(notification.id);
              // A plugin that needs custom notification-click behavior drops its own
              // *.notification-hook.ts file rather than editing this callback - see
              // notificationHooks/registry.ts. Two hooks both claiming the same notification is
              // a plugin-authoring bug (hooks must key off their own disjoint notification
              // types), surfaced loudly in dev rather than silently resolved by install order.
              const matches = resolvedNotificationHooks.filter((hook) => hook.test(notification));
              if (matches.length > 1 && import.meta.env?.DEV) {
                console.warn(
                  `Multiple notification hooks matched notification type "${notification.type}" - only the first will handle it.`,
                );
              }
              if (matches[0]) {
                matches[0].onClick?.(notification, { navigate });
                return;
              }
              if (notification.actionUrl) navigate(notification.actionUrl);
            }}
            onMarkAllNotificationsRead={() => {
              markAllAsRead();
              resolvedNotificationHooks.forEach((hook) => hook.onMarkAllRead?.());
            }}
            onNotificationDelete={removeNotification}
            onLogin={() => navigate('/login')}
            onLogout={logout}
            // inithium:anchor:navbar-props
            logo={{ src: '/logo.webp', alt: appName }}
            title={appName}
            height={NAVBAR_HEIGHT}
          />

          {isPageLoading ? (
            <Box padding={{ base: 16 }} bgColor={{ color: 'surface', intensity: 100 }} style={{ minHeight: 'calc(100vh - 64px)' }} flex={{ justify: 'center', align: 'center' }}>
              <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
            </Box>
          ) : page ? (
            <PageShell page={page} components={pageComponents} navbarHeight={NAVBAR_HEIGHT} fallback={<NotFoundPage />} />
          ) : (
            <NotFoundPage />
          )}

          <Footer
            primaryFooterPages={primaryFooterPages}
            secondaryFooterPages={secondaryFooterPages}
            brandName={appName}
          />
        </>
      ) : (
        <Box
          bgColor={{ color: 'surface', intensity: 100 }}
          className="min-h-screen w-full"
          flex={{ justify: 'center', align: 'center' }}
        >
          {/* Deliberately still hardcoded "Inithium" here, not appName: this shows before
              anything (including the app.name setting) has necessarily resolved, so wiring it up
              would either delay the whole app's first paint on the settings fetch too, or risk a
              jarring text-flash right before this loader unmounts - not worth it for a sub-second
              bootstrap message. */}
          <Loader variant="spinner" size="3rem" color={{ color: 'primary', intensity: 600 }} label="Loading Inithium..." />
        </Box>
      )}

      <AlertContainer />
      <DialogContainer />
      <DrawerContainer />
      <RealtimeConnectionBoundary />
    </Box>
  );
}

export default App;
