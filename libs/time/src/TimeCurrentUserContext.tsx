import { createContext, useContext } from 'react';
import type { AuthUser } from '@inithium/api-client';

// Provided once by TimeShell (which already receives currentUser as a prop from TimeRoot) so any
// component mounted underneath can read "who is the current viewer" without every panel needing
// its own currentUser prop threaded through - mirrors @inithium/cms's identical
// CmsCurrentUserContext.
const TimeCurrentUserContext = createContext<AuthUser | null>(null);

export const TimeCurrentUserProvider = TimeCurrentUserContext.Provider;

// Only ever rendered under TimeShell, which always has a signed-in currentUser by the time it
// mounts (see TimeRoot's gating) - a null read here is a mistake, not a valid empty state.
export const useTimeCurrentUser = (): AuthUser => {
  const currentUser = useContext(TimeCurrentUserContext);
  if (!currentUser) {
    throw new Error('useTimeCurrentUser must be used within TimeShell');
  }
  return currentUser;
};

// The owner bypasses every gate unconditionally; otherwise the viewer's already-resolved
// capabilities decide it. Mirrors @inithium/cms's canAccessCmsResource exactly.
export const canAccessTimeResource = (currentUser: AuthUser, requiredCapability: string): boolean =>
  currentUser.isOwner || currentUser.capabilities.includes(requiredCapability);
