import type { NotificationEntity } from '@inithium/notifications';
import { subscribeToRealtimeChannel } from '../realtime/realtimeClientStore';

// Duplicated rather than imported from @inithium/realtime (which also exports server-only
// gateway code pulling in `ws`/jsonwebtoken) - matches presenceStore.ts's own local
// `presenceChannel` helper, keeping this browser bundle's dependency graph free of anything
// Node-only.
const userChannel = (userId: string): string => `user:${userId}`;

type Listener = () => void;
type NewNotificationListener = (notification: NotificationEntity) => void;

// A single stable reference for "no notifications yet" - useSyncExternalStore compares
// getSnapshot's return by reference, so a fresh `[]` literal on every call (e.g. before the
// map has an entry for this userId) reads as "the store changed" on every render and loops
// forever. Returning this same array every time until real data lands avoids that entirely.
const EMPTY_NOTIFICATIONS: NotificationEntity[] = [];

const notificationsByUser = new Map<string, NotificationEntity[]>();
const unreadCountByUser = new Map<string, number>();
const listenersByUser = new Map<string, Set<Listener>>();
const newNotificationListenersByUser = new Map<string, Set<NewNotificationListener>>();
const unsubscribeByUser = new Map<string, () => void>();

const emit = (userId: string) => listenersByUser.get(userId)?.forEach((listener) => listener());

// Subscribes once per userId, on whichever hook call reaches it first - every Navbar/boundary
// watching the same user's notifications shares this one wire subscription, the same sharing
// presenceStore.ts already gives for free.
const ensureSubscribed = (userId: string) => {
  if (unsubscribeByUser.has(userId)) return;
  const unsubscribe = subscribeToRealtimeChannel(userChannel(userId), (event, payload) => {
    if (event !== 'notification:new') return;
    const notification = payload as NotificationEntity;
    const existing = notificationsByUser.get(userId) ?? [];
    notificationsByUser.set(userId, [notification, ...existing]);
    if (!notification.isRead) {
      unreadCountByUser.set(userId, (unreadCountByUser.get(userId) ?? 0) + 1);
    }
    newNotificationListenersByUser.get(userId)?.forEach((listener) => listener(notification));
    emit(userId);
  });
  unsubscribeByUser.set(userId, unsubscribe);
};

export const hydrateNotifications = (userId: string, list: NotificationEntity[]): void => {
  notificationsByUser.set(userId, list);
  emit(userId);
};

export const hydrateUnreadCount = (userId: string, count: number): void => {
  unreadCountByUser.set(userId, count);
  emit(userId);
};

export const getNotifications = (userId: string): NotificationEntity[] =>
  notificationsByUser.get(userId) ?? EMPTY_NOTIFICATIONS;
export const getUnreadCount = (userId: string): number => unreadCountByUser.get(userId) ?? 0;

export const markLocalNotificationRead = (userId: string, id: string): void => {
  const list = notificationsByUser.get(userId);
  if (!list) return;
  let changed = false;
  notificationsByUser.set(
    userId,
    list.map((notification) => {
      if (notification.id === id && !notification.isRead) {
        changed = true;
        return { ...notification, isRead: true };
      }
      return notification;
    }),
  );
  if (!changed) return;
  unreadCountByUser.set(userId, Math.max(0, (unreadCountByUser.get(userId) ?? 0) - 1));
  emit(userId);
};

export const markAllLocalNotificationsRead = (userId: string): void => {
  const list = notificationsByUser.get(userId);
  if (list) {
    notificationsByUser.set(userId, list.map((notification) => ({ ...notification, isRead: true })));
  }
  unreadCountByUser.set(userId, 0);
  emit(userId);
};

export const removeLocalNotification = (userId: string, id: string): void => {
  const list = notificationsByUser.get(userId);
  if (!list) return;
  const target = list.find((notification) => notification.id === id);
  if (!target) return;
  notificationsByUser.set(
    userId,
    list.filter((notification) => notification.id !== id),
  );
  if (!target.isRead) {
    unreadCountByUser.set(userId, Math.max(0, (unreadCountByUser.get(userId) ?? 0) - 1));
  }
  emit(userId);
};

export const subscribeToNotifications = (userId: string, listener: Listener): (() => void) => {
  ensureSubscribed(userId);
  const existing = listenersByUser.get(userId);
  if (existing) existing.add(listener);
  else listenersByUser.set(userId, new Set([listener]));
  return () => listenersByUser.get(userId)?.delete(listener);
};

export const subscribeToNewNotifications = (userId: string, listener: NewNotificationListener): (() => void) => {
  ensureSubscribed(userId);
  const existing = newNotificationListenersByUser.get(userId);
  if (existing) existing.add(listener);
  else newNotificationListenersByUser.set(userId, new Set([listener]));
  return () => newNotificationListenersByUser.get(userId)?.delete(listener);
};
