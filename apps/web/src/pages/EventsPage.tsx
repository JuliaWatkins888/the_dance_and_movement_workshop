import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Button, Icon, Input, Loader, Text } from '@inithium/ui';
import { useListEventsQuery } from '@inithium/api-client';
import type { PublicEventDto } from '@inithium/api-client';
import { ProgramBanner } from './classes/ProgramBanner';
import {
  availabilityLabel,
  bulkDiscountSummary,
  eventLocation,
  filterEvents,
  formatEventDateShort,
  formatEventTimes,
  priceSummary,
} from './events/eventFormat';

const CARD_IMAGE_HEIGHT = 180;

const EventCard = ({ event }: { event: PublicEventDto }) => {
  const isPast = event.status === 'past';
  const location = eventLocation(event);

  return (
    <Link
      to={`/events/${event.slug}`}
      className={[
        'group flex h-full flex-col overflow-hidden rounded-lg border border-surface-300 bg-surface-100 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500',
        isPast ? 'opacity-60 grayscale' : '',
      ].join(' ')}
    >
      <ProgramBanner
        program={{ id: event.id, name: event.title, imageUrl: event.imageUrl, banner: event.banner }}
        height={CARD_IMAGE_HEIGHT}
        className="transition-transform duration-300 group-hover:scale-[1.02]"
      />
      <Box flex={{ direction: 'col', gap: 10 }} className="flex-1 p-5">
        <Box flex={{ direction: 'col', gap: 4 }}>
          <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-bold leading-tight">
            {event.title}
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
            {formatEventDateShort(event.date)} · {formatEventTimes(event)}
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
            {location.name}
          </Text>
        </Box>

        {event.description ? (
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="line-clamp-3 text-sm">
            {event.description}
          </Text>
        ) : null}

        <Box flex={{ direction: 'row', justify: 'between', align: 'end', gap: 8 }} className="mt-auto pt-2">
          <Box flex={{ direction: 'col', gap: 2 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 950 }} className="text-base font-semibold">
              {priceSummary(event)}
            </Text>
            {event.bulkDiscount ? (
              <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-xs">
                {bulkDiscountSummary(event.bulkDiscount)}
              </Text>
            ) : null}
          </Box>
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-right text-xs font-medium">
            {availabilityLabel(event)}
          </Text>
        </Box>
      </Box>
    </Link>
  );
};

const EventGrid = ({ events }: { events: PublicEventDto[] }) => (
  <Box className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
    {events.map((event) => (
      <EventCard key={event.id} event={event} />
    ))}
  </Box>
);

export const EventsPage = () => {
  const { data: events = [], isLoading } = useListEventsQuery();
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const hasFilters = Boolean(search.trim()) || Boolean(from) || Boolean(to);
  const filtered = useMemo(
    () => filterEvents(events, { search, from: from || undefined, to: to || undefined }),
    [events, search, from, to],
  );
  const upcoming = filtered.filter((event) => event.status !== 'past');
  const past = filtered.filter((event) => event.status === 'past');

  const clearFilters = () => {
    setSearch('');
    setFrom('');
    setTo('');
  };

  return (
    <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }}>
      <Box flex={{ direction: 'col', gap: 8 }}>
        <Text textColor={{ color: 'surface', intensity: 950 }} as="h1" className="text-3xl font-bold">
          Events
        </Text>
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="max-w-3xl text-sm">
          Recitals, showcases, and other studio events. Get your tickets here.
        </Text>
      </Box>

      {isLoading ? (
        <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
          <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
        </Box>
      ) : events.length === 0 ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          No events are scheduled right now. Check back soon!
        </Text>
      ) : (
        <>
          <Box className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-[2fr_1fr_1fr]">
            <Input
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Event or venue..."
              entryAdornment={<Icon as="span" name="MagnifyingGlass" size={16} />}
            />
            <Input label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Input label="To" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
          </Box>

          {filtered.length === 0 ? (
            <Box flex={{ direction: 'col', align: 'start', gap: 8 }}>
              <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
                No events match those filters.
              </Text>
              {hasFilters ? (
                <Button variant={{ kind: 'ghost', color: 'primary' }} onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </Box>
          ) : null}

          {upcoming.length > 0 ? <EventGrid events={upcoming} /> : null}

          {past.length > 0 ? (
            <Box flex={{ direction: 'col', gap: 12 }}>
              <Text as="h2" textColor={{ color: 'surface', intensity: 700 }} className="text-sm font-semibold uppercase tracking-wide">
                Past events
              </Text>
              <EventGrid events={past} />
            </Box>
          ) : null}
        </>
      )}
    </Box>
  );
};

export default EventsPage;
