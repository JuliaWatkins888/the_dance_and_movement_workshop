import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { NotificationEntity } from '@inithium/notifications';
import {
  useGetNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
} from '../endpoints/notifications.endpoints';
import {
  getNotifications,
  getUnreadCount,
  hydrateNotifications,
  hydrateUnreadCount,
  markLocalNotificationRead,
  markAllLocalNotificationsRead,
  removeLocalNotification,
  subscribeToNotifications,
  subscribeToNewNotifications,
} from './notificationStore';

// Stable reference for the "no userId yet" case - useSyncExternalStore compares getSnapshot's
// return by reference, so a fresh `[]` literal returned inline on every call reads as "the
// store changed" on every render and loops forever (see notificationStore.ts's own
// EMPTY_NOTIFICATIONS for the same fix on the userId-is-defined path).
const EMPTY_NOTIFICATIONS: NotificationEntity[] = [];

export interface UseNotificationCenterOptions {
  // Fired once per notification as it arrives over the WS channel - e.g. to trigger a toast.
  // Uses a ref internally so callers can pass an inline arrow function without resubscribing.
  readonly onNotification?: (notification: NotificationEntity) => void;
}

export interface UseNotificationCenterResult {
  readonly notifications: NotificationEntity[];
  readonly unreadCount: number;
  readonly markAsRead: (id: string) => void;
  readonly markAllAsRead: () => void;
  readonly removeNotification: (id: string) => void;
}

export const useNotificationCenter = (
  userId: string | undefined,
  options: UseNotificationCenterOptions = {},
): UseNotificationCenterResult => {
  const { data: listData } = useGetNotificationsQuery(undefined, { skip: !userId });
  const { data: countData } = useGetUnreadNotificationCountQuery(undefined, { skip: !userId });
  const [markReadMutation] = useMarkNotificationReadMutation();
  const [markAllReadMutation] = useMarkAllNotificationsReadMutation();
  const [deleteNotificationMutation] = useDeleteNotificationMutation();

  useEffect(() => {
    if (userId && listData) hydrateNotifications(userId, listData);
  }, [userId, listData]);

  useEffect(() => {
    if (userId && countData) hydrateUnreadCount(userId, countData.count);
  }, [userId, countData]);

  const onNotificationRef = useRef(options.onNotification);
  onNotificationRef.current = options.onNotification;

  useEffect(() => {
    if (!userId) return undefined;
    return subscribeToNewNotifications(userId, (notification) => onNotificationRef.current?.(notification));
  }, [userId]);

  const subscribe = useCallback(
    (listener: () => void) => (userId ? subscribeToNotifications(userId, listener) : () => undefined),
    [userId],
  );
  const notifications = useSyncExternalStore(
    subscribe,
    () => (userId ? getNotifications(userId) : EMPTY_NOTIFICATIONS),
    () => (userId ? getNotifications(userId) : EMPTY_NOTIFICATIONS),
  );
  const unreadCount = useSyncExternalStore(
    subscribe,
    () => (userId ? getUnreadCount(userId) : 0),
    () => (userId ? getUnreadCount(userId) : 0),
  );

  const markAsRead = useCallback(
    (id: string) => {
      if (!userId) return;
      markLocalNotificationRead(userId, id);
      void markReadMutation(id);
    },
    [userId, markReadMutation],
  );

  const markAllAsRead = useCallback(() => {
    if (!userId) return;
    markAllLocalNotificationsRead(userId);
    void markAllReadMutation();
  }, [userId, markAllReadMutation]);

  const removeNotification = useCallback(
    (id: string) => {
      if (!userId) return;
      removeLocalNotification(userId, id);
      void deleteNotificationMutation(id);
    },
    [userId, deleteNotificationMutation],
  );

  return { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification };
};
