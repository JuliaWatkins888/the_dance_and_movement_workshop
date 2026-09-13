export interface TimeEntryEntity {
  id: string;
  // The employee this entry belongs to - always a contributor/editor/admin/owner UserEntity.id,
  // enforced at the route layer (see timeAccess.ts's isEmployee), never here.
  userId: string;
  typeId: string;
  // UTC instant, rounded to the nearest minute at write time (see timeDateUtils's
  // roundToNearestMinute on the frontend and the equivalent route-layer helper on the backend).
  startAt: Date;
  // Absent while the entry is still open (the employee is currently clocked in). Never hand-set
  // by an employee - only a clock-out/switch-type action (self) or a time:manage actor's manual
  // edit (see time-admin.route.ts) can set this.
  endAt?: Date;
  // Owner-only toggle (see time-admin.route.ts's lock/unlock). While true, every mutation route -
  // self retag/delete and admin update/delete alike - rejects with 409 for everyone, including
  // the owner's own edit routes, until explicitly unlocked first.
  locked: boolean;
  // True only when timeSweep.ts's lazy staleness check closed this entry automatically (no real
  // clock-out ever happened) - lets the review UI visually flag it for a human to verify.
  autoClosed: boolean;
  // userId of whoever actually created this row: the employee themself via clock-in, or a
  // time:manage actor via a manual backfill entry on someone else's behalf. Distinct from userId
  // once an admin/owner creates or edits an entry for another employee.
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateTimeEntryInput = Pick<TimeEntryEntity, 'userId' | 'typeId' | 'startAt' | 'createdBy'> &
  Partial<Pick<TimeEntryEntity, 'endAt' | 'locked' | 'autoClosed'>>;

export type UpdateTimeEntryInput = Partial<
  Pick<TimeEntryEntity, 'typeId' | 'startAt' | 'endAt' | 'locked' | 'autoClosed'>
>;

export interface FindEntriesInRangeOptions {
  userId: string;
  from: Date;
  to: Date;
}

export interface FindEntriesForUsersInRangeOptions {
  userIds: string[];
  from: Date;
  to: Date;
}

export interface DeleteInRangeResult {
  deletedCount: number;
  deletedIds: string[];
}

export interface TimeEntryRepository {
  findById: (id: string) => Promise<TimeEntryEntity | null>;
  // At most one open entry can ever exist per employee - enforced by every write path checking
  // this first, never by a DB-level uniqueness constraint (an open entry is "endAt absent", which
  // Mongo can't express as a unique index the way staff.schema.ts's userId index does).
  findOpenByUserId: (userId: string) => Promise<TimeEntryEntity | null>;
  findManyInRange: (options: FindEntriesInRangeOptions) => Promise<TimeEntryEntity[]>;
  // Cross-employee variant for CSV export - the route layer only ever calls this with a userIds
  // list already narrowed by canActOnEmployee, never with an unscoped/unchecked list.
  findManyForUsersInRange: (options: FindEntriesForUsersInRangeOptions) => Promise<TimeEntryEntity[]>;
  // startAt < (endAt ?? FAR_FUTURE) AND (existing.endAt is absent OR existing.endAt > startAt) -
  // an open existing entry's absent endAt is treated as unbounded for this comparison, since an
  // employee can never have two entries open at once. excludeId lets an update check for overlap
  // against every other entry without the entry flagging itself.
  findOverlapping: (userId: string, startAt: Date, endAt: Date | undefined, excludeId?: string) => Promise<TimeEntryEntity[]>;
  countByTypeId: (typeId: string) => Promise<number>;
  create: (input: CreateTimeEntryInput) => Promise<TimeEntryEntity>;
  update: (id: string, input: UpdateTimeEntryInput) => Promise<TimeEntryEntity | null>;
  delete: (id: string) => Promise<boolean>;
  // Bulk purge for the owner-triggered yearly archive (time-settings.route.ts's archive-year) -
  // returns the deleted ids so the caller can also purge their audit rows (which otherwise
  // outlive their parent entry indefinitely).
  deleteInRange: (from: Date, to: Date) => Promise<DeleteInRangeResult>;
}
