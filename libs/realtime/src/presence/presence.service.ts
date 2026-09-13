import { PresenceRecord, PresenceStatus } from '../contracts/presence.contract';
import { getActiveRealtimeProvider } from '../providers/provider-registry';

export const presenceChannel = (userId: string): string => `presence:${userId}`;

// Ephemeral, process-local presence table - deliberately NOT persisted via @inithium/db's
// UserEntity. Presence is a live signal ("is this user connected right now"), not a durable
// fact about the user: persisting it would mean a write to Mongo on every connect/disconnect
// and would go permanently stale if the process crashes without running its own disconnect
// cleanup. It already inherits the in-memory RealtimeProvider's own process-locality - a future
// `realtime-redis` swap would need this table moved to Redis too to stay consistent across
// instances, which is exactly why it's read/written entirely through the swappable
// RealtimeProvider's publish call below rather than talking to a broker/DB directly.
const presenceByUser = new Map<string, PresenceStatus>();

export const getPresence = (userId: string): PresenceRecord => ({
  userId,
  status: presenceByUser.get(userId) ?? 'offline',
  updatedAt: new Date().toISOString(),
});

const publishPresence = async (userId: string, status: PresenceStatus): Promise<void> => {
  const record: PresenceRecord = { userId, status, updatedAt: new Date().toISOString() };
  await getActiveRealtimeProvider().publish(presenceChannel(userId), 'presence:update', record);
};

export const setPresence = async (userId: string, status: PresenceStatus): Promise<void> => {
  presenceByUser.set(userId, status);
  await publishPresence(userId, status);
};

// Called only when a user's *last* live connection closes (see connectionRegistry.ts) - not a
// generic "set offline", since a client can never request "offline" for itself (see
// protocol.ts's SettablePresenceStatus).
export const clearPresence = async (userId: string): Promise<void> => {
  presenceByUser.delete(userId);
  await publishPresence(userId, 'offline');
};
