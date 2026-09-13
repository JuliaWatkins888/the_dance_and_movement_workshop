import { useCallback, useSyncExternalStore } from 'react';
import type { PresenceStatus } from '@inithium/realtime';
import { useGetUserPresenceQuery } from '../endpoints/presence.endpoints';
import { getPresenceStatus, subscribeToPresence } from './presenceStore';

export interface UsePresenceOptions {
  readonly skipInitialFetch?: boolean;
}

// REST (getUserPresence) supplies the value for the instant between mount and the socket's
// first presence:update event; every update after that comes from the shared WS subscription in
// presenceStore.ts, not from re-polling the query. `skip` lets a caller who expects a live
// update imminently (e.g. a list rendering 50 of these at once) opt out of the initial
// round-trip - default is to always fetch it, since a stale "offline" reading looks broken for
// a user who's actually online.
export const usePresence = (userId: string | undefined, options: UsePresenceOptions = {}): PresenceStatus | undefined => {
  const { data } = useGetUserPresenceQuery(userId ?? '', { skip: !userId || options.skipInitialFetch });

  const subscribe = useCallback(
    (listener: () => void) => (userId ? subscribeToPresence(userId, listener) : () => undefined),
    [userId],
  );
  const getSnapshot = useCallback(() => (userId ? getPresenceStatus(userId) : undefined), [userId]);

  const live = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return live ?? data?.status;
};
