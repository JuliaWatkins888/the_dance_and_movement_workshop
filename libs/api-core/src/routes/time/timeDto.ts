import type { TimeEntryEntity } from '@inithium/db';

export const toTimeEntryDto = (entry: TimeEntryEntity) => ({
  id: entry.id,
  userId: entry.userId,
  typeId: entry.typeId,
  startAt: entry.startAt.toISOString(),
  endAt: entry.endAt ? entry.endAt.toISOString() : undefined,
  locked: entry.locked,
  autoClosed: entry.autoClosed,
  createdBy: entry.createdBy,
  createdAt: entry.createdAt.toISOString(),
  updatedAt: entry.updatedAt.toISOString(),
});

export interface TypeTotal {
  typeId: string;
  minutes: number;
}

// An open entry's still-running duration counts up to `now` - lets a "my hours this week"
// summary reflect an in-progress shift instead of only ever showing already-closed time.
export const computeTotalsByType = (entries: TimeEntryEntity[], now: Date = new Date()): TypeTotal[] => {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const endMillis = entry.endAt ? entry.endAt.getTime() : now.getTime();
    const minutes = Math.max(0, Math.round((endMillis - entry.startAt.getTime()) / 60_000));
    totals.set(entry.typeId, (totals.get(entry.typeId) ?? 0) + minutes);
  }
  return [...totals.entries()].map(([typeId, minutes]) => ({ typeId, minutes }));
};
