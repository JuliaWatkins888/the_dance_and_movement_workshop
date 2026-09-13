export const PRESENCE_STATUSES = ['online', 'busy', 'away', 'offline'] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

export interface PresenceRecord {
  readonly userId: string;
  readonly status: PresenceStatus;
  readonly updatedAt: string;
}
