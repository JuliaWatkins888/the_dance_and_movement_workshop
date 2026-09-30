import { Box, Button, Pill, Text } from '@inithium/ui';
import type { CalendarItemDto } from '@inithium/api-client';
import { googleMapsLink } from '../../app/studioLocation';
import { eventLocation } from '../events/eventFormat';
import { formatWhen } from './calendarFormat';

// What a holiday or admin entry opens in place - they have no page of their own.
export const CalendarItemDetails = ({ item, close }: { readonly item: CalendarItemDto; readonly close: () => void }) => {
  const venue = item.location ? eventLocation(item.location) : undefined;

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'col', gap: 8 }}>
        <Text as="p" textColor={{ color: 'surface', intensity: 800 }} className="text-sm font-medium">
          {formatWhen(item)}
        </Text>
        {item.isStudioClosed !== undefined ? (
          <Box flex={{ direction: 'row' }}>
            <Pill
              color={{ color: item.isStudioClosed ? 'tertiary' : 'secondary', intensity: 500 }}
              className={item.isStudioClosed ? 'text-tertiary-foreground-500' : 'text-secondary-foreground-500'}
            >
              {item.isStudioClosed ? 'Studio closed · no classes' : 'Studio open'}
            </Pill>
          </Box>
        ) : null}
      </Box>

      {venue && !item.isStudioClosed ? (
        <Box flex={{ direction: 'col', gap: 2 }}>
          <Text as="p" textColor={{ color: 'surface', intensity: 950 }} className="text-sm font-semibold">
            {venue.name}
          </Text>
          {venue.address ? (
            <a
              href={googleMapsLink(venue.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-surface-800 underline-offset-4 hover:text-accent-500 hover:underline"
            >
              {venue.address}
            </a>
          ) : null}
        </Box>
      ) : null}

      {item.description ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 900 }} className="whitespace-pre-line text-sm">
          {item.description}
        </Text>
      ) : null}

      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }} className="flex-wrap">
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={close}>
          Close
        </Button>
        {item.linkUrl ? (
          <Button asChild variant={{ kind: 'filled', color: 'primary' }}>
            <a href={item.linkUrl} target="_blank" rel="noopener noreferrer">
              More Info
            </a>
          </Button>
        ) : null}
      </Box>
    </Box>
  );
};
