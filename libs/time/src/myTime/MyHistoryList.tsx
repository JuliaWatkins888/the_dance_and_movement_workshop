import { Box, Card, IconButton, Select, SelectItem, Text, dialog } from '@inithium/ui';
import { useDeleteMyTimeEntryMutation, useUpdateMyTimeEntryMutation } from '@inithium/api-client';
import type { TimeEntryDto, TimeEntryTypeDto } from '@inithium/api-client';
import { formatClockTime, formatDurationMinutes, formatZonedDate, zonedDateKey } from '../timeDateUtils';

export interface MyHistoryListProps {
  readonly entries: TimeEntryDto[];
  readonly types: TimeEntryTypeDto[];
  readonly timeZone: string;
  readonly isLoading: boolean;
}

const computeMinutes = (entry: TimeEntryDto): number => {
  const endMillis = entry.endAt ? new Date(entry.endAt).getTime() : Date.now();
  return Math.max(0, Math.round((endMillis - new Date(entry.startAt).getTime()) / 60_000));
};

// Built from core @inithium/ui primitives only (Box/Card/Text/Select/IconButton) - deliberately
// not ListRow/SearchFilterBar, which are injected into libs/ui only by the cms plugin and would
// break this plugin's requirement to work with or without CMS installed.
export const MyHistoryList = ({ entries, types, timeZone, isLoading }: MyHistoryListProps) => {
  const [updateEntry] = useUpdateMyTimeEntryMutation();
  const [deleteEntry] = useDeleteMyTimeEntryMutation();

  const handleRetag = async (entryId: string, typeId: string) => {
    await updateEntry({ id: entryId, typeId }).unwrap();
  };

  // An employee may only ever delete an entry they made by accident (e.g. a stray clock-in) -
  // never edit its times, and never once it's locked (the Select/IconButton below are already
  // disabled in that case).
  const handleDelete = async (entry: TimeEntryDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this entry?',
      description: 'This permanently removes it. Only do this if it was logged by accident.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await deleteEntry(entry.id).unwrap();
  };

  if (isLoading) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
        Loading…
      </Text>
    );
  }
  if (entries.length === 0) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
        No entries in this range.
      </Text>
    );
  }

  const byDay = new Map<string, TimeEntryDto[]>();
  for (const entry of [...entries].sort((a, b) => b.startAt.localeCompare(a.startAt))) {
    const key = zonedDateKey(entry.startAt, timeZone);
    byDay.set(key, [...(byDay.get(key) ?? []), entry]);
  }

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      {[...byDay.entries()].map(([dayKey, dayEntries]) => (
        <Box key={dayKey} flex={{ direction: 'col', gap: 8 }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm font-medium">
            {formatZonedDate(dayEntries[0].startAt, timeZone)}
          </Text>
          <Card padding={{ base: 0 }} className="divide-y divide-surface-200">
            {dayEntries.map((entry) => (
              <Box key={entry.id} flex={{ direction: 'row', align: 'center', justify: 'between', gap: 12 }} padding={{ base: 12 }}>
                <Box flex={{ direction: 'col' }}>
                  <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm">
                    {formatClockTime(entry.startAt, timeZone)} – {entry.endAt ? formatClockTime(entry.endAt, timeZone) : 'now'}
                    {entry.autoClosed ? ' (auto-closed)' : ''}
                  </Text>
                  <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
                    {formatDurationMinutes(computeMinutes(entry))}
                    {entry.locked ? ' · locked' : ''}
                  </Text>
                </Box>
                <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
                  <Select value={entry.typeId} onValueChange={(typeId) => handleRetag(entry.id, typeId)} disabled={entry.locked} className="w-36">
                    {types.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </Select>
                  <IconButton
                    icon="Trash"
                    label="Delete entry"
                    textColor={{ color: 'red', intensity: 600 }}
                    disabled={entry.locked}
                    onClick={() => handleDelete(entry)}
                  />
                </Box>
              </Box>
            ))}
          </Card>
        </Box>
      ))}
    </Box>
  );
};
