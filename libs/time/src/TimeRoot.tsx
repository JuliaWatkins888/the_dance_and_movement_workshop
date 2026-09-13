import { Navigate } from 'react-router-dom';
import { AlertContainer, Box, DialogContainer, DrawerContainer, Loader } from '@inithium/ui';
import type { AuthUser } from '@inithium/api-client';
import { TimeLoginPage } from './TimeLoginPage';
import { TimeShell } from './TimeShell';
import { isEmployee } from './timeAccess';

export interface TimeRootProps {
  readonly currentUser: AuthUser | null;
  readonly isResolving: boolean;
  readonly onLoginSuccess: (token: string) => void;
  readonly onLogout: () => void;
}

const hasAnyTimeCapability = (user: AuthUser): boolean =>
  user.isOwner || user.capabilities.includes('time:track') || user.capabilities.includes('time:manage');

// Everything currentUser-related here arrives as props, never via a hook call - libs/time has no
// knowledge of authStore/useCurrentUser, the same layering @inithium/cms's own CmsRoot uses.
export const TimeRoot = ({ currentUser, isResolving, onLoginSuccess, onLogout }: TimeRootProps) => {
  let content;
  if (isResolving) {
    content = (
      <Box
        bgColor={{ color: 'surface', intensity: 950 }}
        className="min-h-screen w-full"
        flex={{ direction: 'row', justify: 'center', align: 'center' }}
      >
        <Loader variant="spinner" size="3rem" color={{ color: 'primary', intensity: 600 }} label="Loading Time Clock..." />
      </Box>
    );
  } else if (!currentUser) {
    content = <TimeLoginPage onLoginSuccess={onLoginSuccess} />;
  } else if (!isEmployee(currentUser) || !hasAnyTimeCapability(currentUser)) {
    // Credentials were valid - TimeLoginPage already let them through. A signed-in account with
    // no employee standing (a plain 'user' role) or no time capability at all gets no
    // acknowledgement that this area exists: a silent redirect home, mirroring CmsRoot's identical
    // choice for the same reason.
    content = <Navigate to="/" replace />;
  } else {
    content = <TimeShell currentUser={currentUser} onLogout={onLogout} />;
  }

  return (
    <>
      {content}
      <AlertContainer />
      <DialogContainer />
      <DrawerContainer />
    </>
  );
};
