import type { PresenceStatus } from '@inithium/realtime';
import { subscribeToRealtimeChannel } from './realtimeClientStore';

const presenceChannel = (userId: string): string => `presence:${userId}`;

// One small per-user record cache fed entirely by 'presence:update' events off the shared
// socket - deliberately not left for each usePresence call to hold its own local state, so five
// different Avatar instances all showing the same userId share one channel subscription and one
// cached value instead of five independent ones.
const statusByUser = new Map<string, PresenceStatus>();
const listenersByUser = new Map<string, Set<() => void>>();
const unsubscribeByUser = new Map<string, () => void>();

const emit = (userId: string) => listenersByUser.get(userId)?.forEach((listener) => listener());

export const getPresenceStatus = (userId: string): PresenceStatus | undefined => statusByUser.get(userId);

export const subscribeToPresence = (userId: string, listener: () => void): (() => void) => {
  const existing = listenersByUser.get(userId);
  if (existing) {
    existing.add(listener);
  } else {
    listenersByUser.set(userId, new Set([listener]));
    const unsubscribeChannel = subscribeToRealtimeChannel(presenceChannel(userId), (event, payload) => {
      if (event !== 'presence:update') return;
      const record = payload as { status: PresenceStatus };
      statusByUser.set(userId, record.status);
      emit(userId);
    });
    unsubscribeByUser.set(userId, unsubscribeChannel);
  }

  return () => {
    const listeners = listenersByUser.get(userId);
    if (!listeners) return;
    listeners.delete(listener);
    if (listeners.size === 0) {
      listenersByUser.delete(userId);
      unsubscribeByUser.get(userId)?.();
      unsubscribeByUser.delete(userId);
      statusByUser.delete(userId);
    }
  };
};
