import type { ReactElement } from 'react';
import { Box, Button, IconButton, Pill, Text, alert, dialog } from '@inithium/ui';
import { formatMoney, readApiError, useDeleteEventMutation, useListEventsAdminQuery } from '@inithium/api-client';
import type { EventDto } from '@inithium/api-client';
import { DIALOG_WIDTH_WIDE, EmptyState, useStoreCurrency } from '../ecommerce/shared';
import { ALERT_POSITION, formatTime12h } from '../classes/classAdmin.shared';
import { EventEditDialog } from './EventEditDialog';

// Calendar dates are stored as UTC midnight - format in UTC so they never shift a day.
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const isPast = (event: EventDto, now: Date): boolean => new Date(event.endsAt) <= now;

const whenSummary = (event: EventDto): string => {
  const times = event.endTime ? `${formatTime12h(event.startTime)}–${formatTime12h(event.endTime)}` : formatTime12h(event.startTime);
  return `${dateFormatter.format(new Date(event.date))} · ${times}`;
};

const EventRow = ({
  event,
  currency,
  onEdit,
  onDelete,
}: {
  readonly event: EventDto;
  readonly currency: string;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}) => {
  const bulk = event.bulkDiscount;
  const bulkSummary = bulk
    ? `Group: ${bulk.kind === 'percent' ? `${bulk.value}%` : formatMoney(bulk.value, currency)} off each at ${bulk.minTickets}+ tickets`
    : undefined;

  return (
    <Box
      flex={{ direction: 'row', justify: 'between', align: 'start', gap: 12 }}
      borderColor={{ color: 'surface', intensity: 300 }}
      className="flex-wrap rounded-lg border p-4"
    >
      <Box flex={{ direction: 'col', gap: 4 }} className="min-w-0">
        <Box flex={{ direction: 'row', align: 'center', gap: 8 }} className="flex-wrap">
          <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-bold">
            {event.title}
          </Text>
          {!event.isPublished ? (
            <Pill color={{ color: 'surface', intensity: 300 }} className="text-surface-900">
              Draft
            </Pill>
          ) : null}
        </Box>
        <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
          {whenSummary(event)} · {event.isAtStudio ? 'At the studio' : event.venueName}
        </Text>
        <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          {event.ticketTypes
            .map(
              (ticketType) => `${ticketType.name} ${ticketType.priceCents === 0 ? 'Free' : formatMoney(ticketType.priceCents, currency)}`,
            )
            .join(' · ')}
        </Text>
        {bulkSummary ? (
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
            {bulkSummary}
          </Text>
        ) : null}
      </Box>
      <Box flex={{ direction: 'row', align: 'center', gap: 4 }}>
        <IconButton icon="PencilSimple" label={`Edit ${event.title}`} onClick={onEdit} />
        <IconButton icon="Trash" label={`Delete ${event.title}`} textColor={{ color: 'red', intensity: 600 }} onClick={onDelete} />
      </Box>
    </Box>
  );
};

export const EventsAdminModule = () => {
  const currency = useStoreCurrency();
  const { data: events = [], isLoading } = useListEventsAdminQuery();
  const [deleteEvent] = useDeleteEventMutation();

  const now = new Date();
  // The API returns soonest first; past events read better most recent first.
  const upcoming = events.filter((event) => !isPast(event, now));
  const past = events.filter((event) => isPast(event, now)).reverse();

  const openEditDialog = (event?: EventDto) => {
    const render = (close: () => void): ReactElement => <EventEditDialog event={event} onDone={close} />;
    const id = dialog.show(() => render(() => dialog.close(id)), {
      title: event ? `Edit "${event.title}"` : 'New Event',
      width: DIALOG_WIDTH_WIDE,
    });
  };

  const handleDelete = async (event: EventDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this event?',
      description: `This permanently removes "${event.title}" from the site. Tickets already sold stay in their orders; tickets sitting in shoppers’ carts become unavailable.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    try {
      await deleteEvent(event.id).unwrap();
    } catch (error) {
      alert.danger(readApiError(error, 'Could not delete this event.').message, { position: ALERT_POSITION });
    }
  };

  const renderRows = (list: EventDto[]) =>
    list.map((event) => (
      <EventRow
        key={event.id}
        event={event}
        currency={currency}
        onEdit={() => openEditDialog(event)}
        onDelete={() => handleDelete(event)}
      />
    ));

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }} className="flex-wrap">
        <Box flex={{ direction: 'col', gap: 4 }}>
          <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
            Events
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="max-w-2xl text-sm">
            Ticketed single-day events such as recitals. Tickets are sold through the site’s cart and show up under Orders.
          </Text>
        </Box>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => openEditDialog()}>
          Add Event
        </Button>
      </Box>

      {isLoading ? <EmptyState message="Loading events..." /> : null}
      {!isLoading && events.length === 0 ? <EmptyState message="No events yet. Add one to start selling tickets." /> : null}

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
