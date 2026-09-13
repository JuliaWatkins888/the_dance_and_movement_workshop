import { useSyncExternalStore } from 'react';
import { getRealtimeConnectionStatus, subscribeToRealtimeStatus } from './realtimeClientStore';
import type { RealtimeConnectionStatus } from './realtimeClientStore';

// Thin reactive wrapper around realtimeClientStore's own module-level pub/sub, the same recipe
// apps/web's useAuthToken uses for authStore - lets a component (e.g. an initial-load gate
// deciding when the socket has finished its first connection attempt) read connection status
// without owning or duplicating any of the socket lifecycle logic itself.
export const useRealtimeConnectionStatus = (): RealtimeConnectionStatus =>
  useSyncExternalStore(subscribeToRealtimeStatus, getRealtimeConnectionStatus, getRealtimeConnectionStatus);
