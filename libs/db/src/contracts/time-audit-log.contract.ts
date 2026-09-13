export const TIME_AUDIT_ACTIONS = [
  'clock_in',
  'clock_out',
  'type_switch',
  'created',
  'updated',
  'deleted',
  'locked',
  'unlocked',
  'auto_closed',
] as const;
export type TimeAuditAction = (typeof TIME_AUDIT_ACTIONS)[number];

// Deliberately loose (not the full TimeEntryEntity) - just enough for a history panel to show a
// meaningful before/after diff without needing to reconstruct every field on every action.
export interface TimeEntrySnapshot {
  typeId?: string;
  startAt?: Date;
  endAt?: Date;
  locked?: boolean;
}

export interface TimeAuditLogEntity {
  id: string;
  // Never cascade-deleted with its entry - history must survive a delete (see
  // time-admin.route.ts's DELETE handler, which writes a 'deleted' row with the entry's last
  // known state as `before` immediately before removing it).
  entryId: string;
  // The employee whose entry this is - kept alongside actorId (below) since the two differ
  // whenever a time:manage actor creates/edits/locks an entry on someone else's behalf.
  userId: string;
  actorId: string;
  action: TimeAuditAction;
  before?: TimeEntrySnapshot;
  after?: TimeEntrySnapshot;
  createdAt: Date;
}

export type CreateTimeAuditLogInput = Omit<TimeAuditLogEntity, 'id' | 'createdAt'>;

export interface TimeAuditLogRepository {
  create: (input: CreateTimeAuditLogInput) => Promise<TimeAuditLogEntity>;
  findByEntryId: (entryId: string) => Promise<TimeAuditLogEntity[]>;
  // Only ever called by the owner-triggered yearly archive (time-settings.route.ts) immediately
  // after TimeEntryRepository.deleteInRange, using the ids it returns.
  deleteByEntryIds: (entryIds: string[]) => Promise<number>;
}
