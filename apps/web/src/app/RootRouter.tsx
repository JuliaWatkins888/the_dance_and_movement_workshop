import { useEffect } from 'react';
import { buildCustomBrandThemeCss } from '@inithium/ui';
import { useIsDarkModeFeatureEnabled, useCustomBrandColors } from '@inithium/api-client';
import { useCurrentUser } from './useCurrentUser';
import App from './app';
// inithium:block:cms:imports:start
import { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Loader } from '@inithium/ui';
import { authStore } from './authStore';
import { useAuthToken } from './useCurrentUser';

const LazyCmsRoot = lazy(() =>
  import('@inithium/cms').then((module) => ({ default: module.CmsRoot })),
);

const CmsBootLoader = () => (
  <Box
    bgColor={{ color: 'surface', intensity: 950 }}
    className="min-h-screen w-full"
    flex={{ direction: 'row', justify: 'center', align: 'center' }}
  >
    <Loader variant="spinner" size="3rem" color={{ color: 'primary', intensity: 600 }} label="Loading CMS..." />
  </Box>
);
// inithium:block:cms:imports:end
// inithium:block:time:imports:start
import { lazy as lazyForTime, Suspense as SuspenseForTime } from 'react';
import { useLocation as useTimeLocation } from 'react-router-dom';
import { Box as TimeBox, Loader as TimeLoader } from '@inithium/ui';
import { authStore as timeAuthStore } from './authStore';
import { useCurrentUser as useTimeCurrentUserHook } from './useCurrentUser';

const LazyTimeRoot = lazyForTime(() =>
  import('@inithium/time').then((module) => ({ default: module.TimeRoot })),
);

const TimeBootLoader = () => (
  <TimeBox
    bgColor={{ color: 'surface', intensity: 950 }}
    className="min-h-screen w-full"
    flex={{ direction: 'row', justify: 'center', align: 'center' }}
  >
    <TimeLoader variant="spinner" size="3rem" color={{ color: 'primary', intensity: 600 }} label="Loading Time Clock..." />
  </TimeBox>
);
// inithium:block:time:imports:end
// inithium:anchor:imports

// The single place mounted on every route, public site and (when a plugin adds one) any other
// top-level area alike - see the dark-mode/custom-brand-color effect below for why that matters.
export function RootRouter() {
  const { currentUser } = useCurrentUser();

  // Lives here rather than inside App - RootRouter is the one thing mounted on every route,
  // so this is the only place a data-theme stamp reliably reaches all of them (see theme.css's
  // own dark-mode override block, which is keyed off this attribute). Kill-switch pattern: the
  // admin setting gates the feature entirely, matching profile.route.ts's own
  // isDarkModeFeatureEnabled().
  const darkModeFeatureEnabled = useIsDarkModeFeatureEnabled();
  const isDarkMode = darkModeFeatureEnabled && Boolean(currentUser?.darkMode);
  useEffect(() => {
    document.documentElement.dataset.theme = isDarkMode ? 'dark' : 'light';
  }, [isDarkMode]);

  // Also lives here rather than inside App, for the identical reason as the data-theme effect
  // above. Rendered as a plain <style> tag (rather than a useEffect DOM mutation like the
  // data-theme stamp) since a `:root { ... }` rule applies to the whole document regardless of
  // where in the tree the <style> element itself is - React can own its lifecycle declaratively
  // instead of this component manually creating/removing a DOM node. An admin who hasn't
  // customized any color yields an empty string here, so theme.css's own static defaults keep
  // applying untouched.
  const customBrandColors = useCustomBrandColors();
  const customBrandThemeCss = buildCustomBrandThemeCss(customBrandColors);

// inithium:block:cms:route-branches:start

  // Reserves /cms as an admin area separate from the public site's data-driven Page routing in
  // app.tsx: branching here, above App, means App's public-site hooks (page/nav queries) never
  // mount while browsing the CMS, and @inithium/cms is only ever fetched - as its own lazy chunk -
  // once a visitor actually navigates to /cms. `token` is passed through so the CMS can run its own
  // CmsRealtimeBoundary/notification wiring rather than sharing App's.
  const location = useLocation();
  const { isResolving, logout } = useCurrentUser();
  const token = useAuthToken();

  if (location.pathname === '/cms' || location.pathname.startsWith('/cms/')) {
    return (
      <>
        {customBrandThemeCss && <style>{customBrandThemeCss}</style>}
        <Suspense fallback={<CmsBootLoader />}>
          <LazyCmsRoot
            currentUser={currentUser}
            isResolving={isResolving}
            onLoginSuccess={(token: string) => authStore.setToken(token)}
            onLogout={logout}
            token={token}
          />
        </Suspense>
      </>
    );
  }
// inithium:block:cms:route-branches:end
// inithium:block:time:route-branches:start

  // Reserves /time as a second admin-adjacent area, cloning the cms plugin's own branch-above-
  // <App/> pattern for /cms (see that fragment for the full rationale: App's public-site hooks
  // never mount while here, and @inithium/time is only ever fetched - as its own lazy chunk - once
  // a visitor actually navigates to /time). currentUser is the SAME variable already resolved at
  // the top of this function, not re-derived - only isResolving/logout need a second
  // useCurrentUser() call (cheap: backed by the same RTK Query cache entry), mirroring the cms
  // fragment's identical choice. Every new binding below is aliased (`*ForTime`/`Time*`)
  // specifically because this merge target is shared - the cms plugin's own fragment already
  // imports { lazy, Suspense } from 'react', { useLocation } from 'react-router-dom', and
  // { Box, Loader } from '@inithium/ui' into this exact anchor, and a second unaliased import of
  // any of those names in one file is a JS SyntaxError regardless of install order or whether cms
  // is even installed in this workspace.
  const timeLocation = useTimeLocation();
  const { isResolving: isTimeAuthResolving, logout: timeLogout } = useTimeCurrentUserHook();

  if (timeLocation.pathname === '/time' || timeLocation.pathname.startsWith('/time/')) {
    return (
      <>
        {customBrandThemeCss && <style>{customBrandThemeCss}</style>}
        <SuspenseForTime fallback={<TimeBootLoader />}>
          <LazyTimeRoot
            currentUser={currentUser}
            isResolving={isTimeAuthResolving}
            onLoginSuccess={(token: string) => timeAuthStore.setToken(token)}
            onLogout={timeLogout}
          />
        </SuspenseForTime>
      </>
    );
  }
// inithium:block:time:route-branches:end
  // inithium:anchor:route-branches

  return (
    <>
      {customBrandThemeCss && <style>{customBrandThemeCss}</style>}
      <App />
    </>
  );
}

export default RootRouter;
