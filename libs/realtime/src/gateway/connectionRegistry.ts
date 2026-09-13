import type { WebSocket } from 'ws';

// Module-level per-process bookkeeping - there is no existing multi-device session tracking
// anywhere else in this codebase to build on; this is the first of it, and it is the one piece
// of bookkeeping presence needs regardless of which transport library or RealtimeProvider is
// active.
const connectionsByUser = new Map<string, Set<WebSocket>>();

export const registerConnection = (userId: string, socket: WebSocket): void => {
  const existing = connectionsByUser.get(userId);
  if (existing) {
    existing.add(socket);
    return;
  }
  connectionsByUser.set(userId, new Set([socket]));
};

// Returns true only when that was the user's last live connection - i.e. they just went
// offline. Callers must not infer offline from any single socket closing on its own.
export const removeConnection = (userId: string, socket: WebSocket): boolean => {
  const existing = connectionsByUser.get(userId);
  if (!existing) return false;
  existing.delete(socket);
  if (existing.size === 0) {
    connectionsByUser.delete(userId);
    return true;
  }
  return false;
};

export const getConnectionCount = (userId: string): number => connectionsByUser.get(userId)?.size ?? 0;

export const getConnectedUserIds = (): string[] => Array.from(connectionsByUser.keys());
