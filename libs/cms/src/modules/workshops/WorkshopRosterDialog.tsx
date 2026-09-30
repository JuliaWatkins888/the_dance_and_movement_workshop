import { Box, Button, Divider, Text } from '@inithium/ui';
import { formatDate, useGetWorkshopRosterQuery } from '@inithium/api-client';
import type { WorkshopDto, WorkshopRosterEntryDto } from '@inithium/api-client';
import { EmptyState } from '../ecommerce/shared';
import { formatWorkshopDay } from './workshopAdmin.shared';

export interface WorkshopRosterDialogProps {
  readonly workshop: WorkshopDto;
  readonly onDone: () => void;
}

const daysLabel = (workshop: WorkshopDto, entry: WorkshopRosterEntryDto): string =>
  entry.isFullWorkshop
    ? `All ${workshop.days.length} days`
    : workshop.days
        .filter((day) => entry.dayIds.includes(day.id))
        .map((day) => formatWorkshopDay(day.date))
        .join(', ');

// Who's coming, day by day - read-only; seats are managed through each day's capacity.
export const WorkshopRosterDialog = ({ workshop, onDone }: WorkshopRosterDialogProps) => {
  const { data: roster = [], isLoading } = useGetWorkshopRosterQuery(workshop.id);

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'col', gap: 4 }}>
        {workshop.days.map((day) => (
          <Box key={day.id} flex={{ direction: 'row', justify: 'between', gap: 8 }}>
            <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
              {formatWorkshopDay(day.date)}
            </Text>
            <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm tabular-nums">
              {day.enrolled}/{day.capacity} registered
            </Text>
          </Box>
        ))}
      </Box>

      <Divider color={{ color: 'surface', intensity: 300 }} />

      {isLoading ? (
        <EmptyState message="Loading registrations..." />
      ) : roster.length === 0 ? (
        <EmptyState message="No one has registered yet." />
      ) : (
        <Box flex={{ direction: 'col' }}>
          {roster.map((entry, index) => (
            <Box key={entry.id}>
              {index > 0 ? <Divider color={{ color: 'surface', intensity: 200 }} /> : null}
              <Box
                flex={{
                  direction: 'row',
                  justify: 'between',
                  align: 'start',
                  gap: 12,
                }}
                padding={{ top: 10, bottom: 10 }}
                className="flex-wrap"
              >
                <Box flex={{ direction: 'col', gap: 2 }} className="min-w-0">
                  <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
                    {entry.attendee.name}
                    {entry.attendee.type === 'self' ? ' (adult)' : ''}
                  </Text>
                  <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
                    {daysLabel(workshop, entry)}
                  </Text>
                  {entry.account ? (
                    <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
                      Account: {entry.account.name} · {entry.account.email}
                    </Text>
                  ) : null}
                </Box>
                <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="shrink-0 text-xs">
                  Registered {formatDate(entry.createdAt)}
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <Box flex={{ direction: 'row', justify: 'end' }}>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={onDone}>
          Close
        </Button>
      </Box>
    </Box>
  );
};
