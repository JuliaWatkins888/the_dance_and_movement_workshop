export interface NotificationEntity {
  id: string;
  userId: string;
  // Namespaced event/notification type, e.g. 'friend:request-received', 'game:invite' - mirrors
  // the realtime event-name convention. Purely descriptive; nothing in this package branches on it.
  type: string;
  title: string;
  body?: string;
  // Where clicking the notification navigates to, e.g. '/docs', '/games/join/abc123'. Plain
  // client-side route string - the creator of the notification is responsible for it being real.
  actionUrl?: string;
  icon?: string;
  isRead: boolean;
  createdAt: Date;
}

export type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
  icon?: string;
};

export interface NotificationRepository {
  create: (input: CreateNotificationInput) => Promise<NotificationEntity>;
  listForUser: (userId: string, options?: { limit?: number }) => Promise<NotificationEntity[]>;
  countUnreadForUser: (userId: string) => Promise<number>;
  // Scoped by userId in the query itself (not just the WHERE-after-fetch) so a caller can never
  // mark another user's notification as read by guessing an id - matches the ownership model a
  // notification needs that Page (admin-managed, not user-owned) never had to enforce.
  markAsRead: (id: string, userId: string) => Promise<NotificationEntity | null>;
  markAllAsReadForUser: (userId: string) => Promise<number>;
  // Scoped by userId in the query itself, matching markAsRead's own ownership guarantee - a
  // caller can never delete another user's notification by guessing an id.
  deleteForUser: (id: string, userId: string) => Promise<boolean>;
  // Not userId-scoped, unlike every other delete here - this is an internal cleanup primitive
  // (e.g. the contact plugin sweeping every notification that pointed at a communication thread
  // it just deleted, regardless of which user held it), never wired to a route that takes an
  // arbitrary actionUrl from client input.
  deleteByActionUrls: (actionUrls: string[]) => Promise<number>;
}
