import { Box, Card, Pill, Text } from '@inithium/ui';
import type { TimeEntryTypeDto, TimeEntryTypeTotalDto } from '@inithium/api-client';
import { formatDurationMinutes } from '../timeDateUtils';

export interface TotalsByTypeSummaryProps {
  readonly totals: TimeEntryTypeTotalDto[];
  readonly types: TimeEntryTypeDto[];
  readonly title?: string;
}

// Shared between MyTimePanel and ReviewPanel - both need the identical "totals by type" chip row,
// just fed a different range/employee.
export const TotalsByTypeSummary = ({ totals, types, title = 'Totals' }: TotalsByTypeSummaryProps) => {
  const labelById = new Map(types.map((type) => [type.id, type.label]));
  const totalMinutes = totals.reduce((sum, total) => sum + total.minutes, 0);

  return (
    <Card padding={{ base: 16 }}>
      <Box flex={{ direction: 'col', gap: 12 }}>
        <Box flex={{ direction: 'row', justify: 'between', align: 'center' }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm font-medium uppercase tracking-wide">
            {title}
          </Text>
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-bold">
            {formatDurationMinutes(totalMinutes)}
          </Text>
        </Box>

        {totals.length > 0 ? (
          <Box flex={{ direction: 'row', gap: 8 }} className="flex-wrap">
            {totals
              .filter((total) => total.minutes > 0)
              .map((total) => (
                <Pill key={total.typeId} color={{ color: 'primary', intensity: 100 }}>
                  {labelById.get(total.typeId) ?? 'Unknown'} · {formatDurationMinutes(total.minutes)}
                </Pill>
              ))}
          </Box>
        ) : (
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
            No time logged in this range.
          </Text>
        )}
      </Box>
    </Card>
  );
};
