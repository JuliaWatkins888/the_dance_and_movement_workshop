import { useSyncExternalStore } from 'react';
import { useGetMeQuery, usePresence } from '@inithium/api-client';
import type { AuthUser, PresenceStatus } from '@inithium/api-client';
import { authStore } from './authStore';

export const useAuthToken = (): string | null =>
  useSyncExternalStore(authStore.subscribe, authStore.getToken, authStore.getToken);

export interface CurrentUser extends AuthUser {
  readonly status?: PresenceStatus;
}

export interface UseCurrentUserResult {
  readonly currentUser: CurrentUser | null;
  // True only while a token exists and /auth/me hasn't resolved yet - false immediately when
  // there's no token (nothing to wait for) and false again as soon as the first response lands.
  // Lets an initial-load gate (see app.tsx) hold off rendering a logged-out Navbar for a split
  // second before the stored token gets a chance to resolve into a user.
  readonly isResolving: boolean;
  readonly logout: () => void;
}

export const useCurrentUser = (): UseCurrentUserResult => {
  const token = useAuthToken();
  const { data: user, isLoading } = useGetMeQuery(undefined, { skip: !token });
  // Own live presence, not a friend's or stranger's - reuses the exact same usePresence hook a
  // future friends list would call per-friend, just pointed at "me" so the Navbar's own avatar
  // shows the same status other users would eventually see for this account.
  const status = usePresence(token ? user?.id : undefined);

  return {
    currentUser: token && user ? { ...user, status } : null,
    isResolving: Boolean(token) && isLoading,
    logout: () => authStore.setToken(null),
  };
};
