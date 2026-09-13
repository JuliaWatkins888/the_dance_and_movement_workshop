import type { TimeEntryDto, TimeEntryTypeTotalDto } from '@inithium/api-client';

// Client-side equivalent of the backend's computeTotalsByType (see this plugin's
// api-core/routes/time/timeDto.ts) - needed only for the "All Employees" review view, which has
// no server-computed summary endpoint of its own (unlike the single-employee view's
// useGetTimeSummaryAdminQuery): totaling a flat list of entries by type is simple enough not to
// warrant a second backend round-trip once the entries themselves are already in hand.
export const computeEntryTotalsByType = (entries: TimeEntryDto[]): TimeEntryTypeTotalDto[] => {
  const totals = new Map<string, number>();
  const now = Date.now();
  for (const entry of entries) {
    const endMillis = entry.endAt ? new Date(entry.endAt).getTime() : now;
    const minutes = Math.max(0, Math.round((endMillis - new Date(entry.startAt).getTime()) / 60_000));
    totals.set(entry.typeId, (totals.get(entry.typeId) ?? 0) + minutes);
  }
  return [...totals.entries()].map(([typeId, minutes]) => ({ typeId, minutes }));
};
