import { Navigate } from 'react-router-dom';
import { AlertContainer, Box, DialogContainer, DrawerContainer, Loader } from '@inithium/ui';
import type { AuthUser } from '@inithium/api-client';
import { CmsLoginPage } from './CmsLoginPage';
import { CmsShell } from './CmsShell';
import { CmsRealtimeBoundary } from './CmsRealtimeBoundary';

export interface CmsRootProps {
  readonly currentUser: AuthUser | null;
  readonly isResolving: boolean;
  readonly onLoginSuccess: (token: string) => void;
  readonly onLogout: () => void;
  // The raw access token, passed alongside currentUser so CmsRealtimeBoundary can open a live
  // socket for the notification center - currentUser alone doesn't carry it.
  readonly token: string | null;
}

// Everything currentUser-related here arrives as props, never via a hook call - libs/cms has no
// knowledge of authStore/useCurrentUser, the same layering @inithium/ui's Navbar already uses
// for currentUser/onLogin/onLogout.
export const CmsRoot = ({ currentUser, isResolving, onLoginSuccess, onLogout, token }: CmsRootProps) => {
  // alert/dialog/drawer are module-level singleton stores, not React context - calling
  // dialog.show()/alert.show()/drawer.show() always succeeds silently regardless of what's
  // mounted, but nothing actually renders without one of these *Container components present
  // somewhere in the currently-mounted tree. app.tsx mounts its own copy for the public site;
  // RootRouter deliberately never mounts App while on /cms, so the CMS needs its own copy here.
  let content;
  if (isResolving) {
    content = (
      <Box
        bgColor={{ color: 'surface', intensity: 950 }}
        className="min-h-screen w-full"
        flex={{ direction: 'row', justify: 'center', align: 'center' }}
      >
        <Loader variant="spinner" size="3rem" color={{ color: 'primary', intensity: 600 }} label="Loading CMS..." />
      </Box>
    );
  } else if (!currentUser) {
    content = <CmsLoginPage onLoginSuccess={onLoginSuccess} />;
  } else if (!currentUser.isOwner && currentUser.capabilities.length === 0) {
    // Credentials were valid - CmsLoginPage already let them through. A viewer with no CMS
    // capabilities at all gets no acknowledgement that an admin area exists: a silent redirect
    // home, not an "access denied" message, so /cms reveals nothing to an account that can't use
    // it. Per-module visibility beyond this base gate is CmsSidebar/ModuleRenderer's job.
    content = <Navigate to="/" replace />;
  } else {
    content = <CmsShell currentUser={currentUser} onLogout={onLogout} />;
  }

  return (
    <>
      {content}
      <AlertContainer />
      <DialogContainer />
      <DrawerContainer />
      <CmsRealtimeBoundary token={token} />
    </>
  );
};
