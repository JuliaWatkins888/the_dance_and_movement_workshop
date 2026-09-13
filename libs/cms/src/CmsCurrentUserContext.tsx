import { createContext, useContext } from 'react';
import type { AuthUser } from '@inithium/api-client';

// Provided once by CmsShell (which already receives currentUser as a prop from CmsRoot) so any
// component mounted underneath - CmsSidebar, ModuleRenderer, DashboardPage, a module/widget's own
// content - can read "who is the current viewer" without CmsModule/DashboardWidget's Component
// contract needing a currentUser prop. That contract is implemented independently by every
// plugin's own module/widget files, so widening it would be a breaking change to every existing
// one; a context avoids that entirely.
const CmsCurrentUserContext = createContext<AuthUser | null>(null);

export const CmsCurrentUserProvider = CmsCurrentUserContext.Provider;

// Only ever rendered under CmsShell, which always has a signed-in currentUser by the time it
// mounts (see CmsRoot's gating) - a null read here is a mistake, not a valid empty state.
export const useCmsCurrentUser = (): AuthUser => {
  const currentUser = useContext(CmsCurrentUserContext);
  if (!currentUser) {
    throw new Error('useCmsCurrentUser must be used within CmsShell');
  }
  return currentUser;
};

// Shared by CmsSidebar/ModuleRenderer/DashboardPage - the owner bypasses every gate
// unconditionally, an ungated resource (no requiredCapability) is open to any CMS-capable
// viewer, otherwise the viewer's already-resolved capabilities decide it.
export const canAccessCmsResource = (currentUser: AuthUser, requiredCapability?: string): boolean =>
  currentUser.isOwner || !requiredCapability || currentUser.capabilities.includes(requiredCapability);
