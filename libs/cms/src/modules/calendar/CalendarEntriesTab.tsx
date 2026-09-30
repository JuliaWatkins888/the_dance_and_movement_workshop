import type { ReactElement } from 'react';
import { Box, Button, IconButton, Pill, Text, alert, dialog } from '@inithium/ui';
import { readApiError, useDeleteCalendarEntryMutation, useListCalendarEntriesAdminQuery } from '@inithium/api-client';
import type { CalendarEntryDto } from '@inithium/api-client';
import { DIALOG_WIDTH_WIDE, EmptyState } from '../ecommerce/shared';
import { ALERT_POSITION, formatCalendarDate, formatTime12h } from '../classes/classAdmin.shared';
import { CalendarEntryEditDialog } from './CalendarEntryEditDialog';

const DAY_MS = 86_400_000;

// endDate is UTC midnight of the last day, so the entry runs until that whole day has passed.
const isPast = (entry: CalendarEntryDto, now: Date): boolean => new Date(entry.endDate).getTime() + DAY_MS <= now.getTime();

const whenSummary = (entry: CalendarEntryDto): string => {
  const dates =
    entry.startDate === entry.endDate
      ? formatCalendarDate(entry.startDate)
      : `${formatCalendarDate(entry.startDate)} – ${formatCalendarDate(entry.endDate)}`;
  if (!entry.startTime || !entry.endTime) return `${dates} · All day`;
  return entry.startDate === entry.endDate
    ? `${dates} · ${formatTime12h(entry.startTime)}–${formatTime12h(entry.endTime)}`
    : `${formatCalendarDate(entry.startDate)} ${formatTime12h(entry.startTime)} – ${formatCalendarDate(entry.endDate)} ${formatTime12h(entry.endTime)}`;
};

const EntryRow = ({
  entry,
  onEdit,
  onDelete,
}: {
  readonly entry: CalendarEntryDto;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}) => (
  <Box
    flex={{ direction: 'row', justify: 'between', align: 'start', gap: 12 }}
    borderColor={{ color: 'surface', intensity: 300 }}
    className="flex-wrap rounded-lg border p-4"
  >
    <Box flex={{ direction: 'col', gap: 4 }} className="min-w-0">
      <Box flex={{ direction: 'row', align: 'center', gap: 8 }} className="flex-wrap">
        <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-bold">
          {entry.title}
        </Text>
        {entry.isStudioClosed ? (
          <Pill color={{ color: 'tertiary', intensity: 500 }} className="text-tertiary-foreground-500">
            Studio Closed
          </Pill>
        ) : null}
        {!entry.isPublished ? (
          <Pill color={{ color: 'surface', intensity: 300 }} className="text-surface-900">
            Draft
          </Pill>
        ) : null}
      </Box>
      <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
        {whenSummary(entry)}
        {entry.isStudioClosed ? '' : ` · ${entry.isAtStudio ? 'At the studio' : entry.venueName}`}
      </Text>
      {entry.description ? (
        <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="line-clamp-2 text-sm">
          {entry.description}
        </Text>
      ) : null}
    </Box>
    <Box flex={{ direction: 'row', align: 'center', gap: 4 }}>
      <IconButton icon="PencilSimple" label={`Edit ${entry.title}`} onClick={onEdit} />
      <IconButton icon="Trash" label={`Delete ${entry.title}`} textColor={{ color: 'red', intensity: 600 }} onClick={onDelete} />
    </Box>
  </Box>
);

export const CalendarEntriesTab = () => {
  const { data: entries = [], isLoading } = useListCalendarEntriesAdminQuery();
  const [deleteEntry] = useDeleteCalendarEntryMutation();

  const now = new Date();
  // The API returns soonest first; past entries read better most recent first.
  const upcoming = entries.filter((entry) => !isPast(entry, now));
  const past = entries.filter((entry) => isPast(entry, now)).reverse();

  const openEditDialog = (entry?: CalendarEntryDto) => {
    const render = (close: () => void): ReactElement => <CalendarEntryEditDialog entry={entry} onDone={close} />;
    const id = dialog.show(() => render(() => dialog.close(id)), {
      title: entry ? `Edit "${entry.title}"` : 'New Calendar Entry',
      width: DIALOG_WIDTH_WIDE,
    });
  };

  const handleDelete = async (entry: CalendarEntryDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this calendar entry?',
      description: entry.isStudioClosed
        ? `This removes "${entry.title}" and its closure - class sessions on those dates will show on the calendar again.`
        : `This permanently removes "${entry.title}" from the calendar.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    try {
      await deleteEntry(entry.id).unwrap();
    } catch (error) {
      alert.danger(readApiError(error, 'Could not delete this calendar entry.').message, { position: ALERT_POSITION });
    }
  };

  const renderRows = (list: CalendarEntryDto[]) =>
    list.map((entry) => (
      <EntryRow key={entry.id} entry={entry} onEdit={() => openEditDialog(entry)} onDelete={() => handleDelete(entry)} />
    ));

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }} className="flex-wrap">
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="max-w-2xl text-sm">
          Studio closures and anything else you want on the public calendar. Classes, workshops, and events are added
          automatically from their own modules.
        </Text>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => openEditDialog()}>
          Add Entry
        </Button>
      </Box>

      {isLoading ? <EmptyState message="Loading calendar entries..." /> : null}
      {!isLoading && entries.length === 0 ? <EmptyState message="No calendar entries yet." /> : null}

      {upcoming.length > 0 ? (
        <Box flex={{ direction: 'col', gap: 12 }}>
          <Text as="h2" textColor={{ color: 'surface', intensity: 700 }} className="text-sm font-semibold uppercase tracking-wide">
            Upcoming
          </Text>
          {renderRows(upcoming)}
        </Box>
      ) : null}

      {past.length > 0 ? (
        <Box flex={{ direction: 'col', gap: 12 }}>
          <Text as="h2" textColor={{ color: 'surface', intensity: 700 }} className="text-sm font-semibold uppercase tracking-wide">
            Past
          </Text>
          {renderRows(past)}
        </Box>
      ) : null}
    </Box>
  );
};
