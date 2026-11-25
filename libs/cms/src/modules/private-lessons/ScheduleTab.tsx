import { useState } from 'react';
import { Box, Button, Loader, Pill, Select, SelectItem, Text } from '@inithium/ui';
import { formatMoney, useGetPrivateLessonScheduleQuery, useListPrivateLessonInstructorsQuery } from '@inithium/api-client';
import type { PrivateLessonScheduleItemDto } from '@inithium/api-client';
import { EmptyState, useStoreCurrency } from '../ecommerce/shared';
import { OccurrenceActions } from './occurrenceActions';
import { addDays, formatFullDate, formatLongDay, formatTimeRange, todayKey, weekStartOf } from './privateLessonFormat';

const ALL_INSTRUCTORS = 'all';

const ScheduleRow = ({ item, currency }: { readonly item: PrivateLessonScheduleItemDto; readonly currency: string }) => {
  const isCancelled = item.status === 'cancelled';
  return (
    <Box
      flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }}
      borderColor={{ color: 'surface', intensity: 200 }}
      padding={{ base: 12 }}
      className="flex-wrap rounded border"
    >
      <Box flex={{ direction: 'col' }} className="min-w-0 flex-1">
        <Text as="span" textColor={{ color: 'surface', intensity: isCancelled ? 600 : 950 }} className={isCancelled ? 'font-medium line-through' : 'font-medium'}>
          {`${formatTimeRange(item.startTime, item.endTime)} · ${item.title} · ${item.attendee.name}`}
        </Text>
        <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
          {[
            item.instructor ? `with ${item.instructor.name}` : 'No instructor',
            item.attendee.type === 'child' && item.accountName ? `account: ${item.accountName}` : undefined,
            formatMoney(item.rateCents, currency),
            item.isMoved ? `moved from ${formatLongDay(item.scheduledDate)}` : undefined,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </Box>
      <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
        {isCancelled ? (
          <Pill color={{ color: 'surface', intensity: 300 }} className="text-surface-900">
            Cancelled
          </Pill>
        ) : item.isMoved ? (
          <Pill color={{ color: 'accent', intensity: 500 }} className="text-accent-foreground-500">
            Moved
          </Pill>
        ) : null}
        <OccurrenceActions occurrence={item} label={`${item.attendee.name}’s ${item.title}`} />
      </Box>
    </Box>
  );
};

// One week of private lessons, day by day, for every instructor or one.
export const ScheduleTab = () => {
  const currency = useStoreCurrency();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayKey()));
  const [instructorStaffId, setInstructorStaffId] = useState(ALL_INSTRUCTORS);
  const { data: instructors = [] } = useListPrivateLessonInstructorsQuery();
  const weekEnd = addDays(weekStart, 7);
  const { data: items = [], isLoading, isFetching, isError } = useGetPrivateLessonScheduleQuery({
    from: weekStart,
    to: weekEnd,
    ...(instructorStaffId !== ALL_INSTRUCTORS ? { instructorStaffId } : {}),
  });

  const days = Array.from({ length: 7 }, (_, offset) => addDays(weekStart, offset))
    .map((dateKey) => ({ dateKey, items: items.filter((item) => item.date === dateKey) }))
    .filter((day) => day.items.length > 0);

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'end', gap: 12 }} className="flex-wrap">
        <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
          <Button variant={{ kind: 'outlined', color: 'surface' }} textColor={{ color: 'surface', intensity: 900 }} onClick={() => setWeekStart(addDays(weekStart, -7))}>
            Previous week
          </Button>
          <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={() => setWeekStart(weekStartOf(todayKey()))}>
            This week
          </Button>
          <Button variant={{ kind: 'outlined', color: 'surface' }} textColor={{ color: 'surface', intensity: 900 }} onClick={() => setWeekStart(weekEnd)}>
            Next week
          </Button>
          <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
            {`${formatFullDate(weekStart)} – ${formatFullDate(addDays(weekEnd, -1))}${isFetching && !isLoading ? ' · refreshing…' : ''}`}
          </Text>
        </Box>
        <Select label="Instructor" value={instructorStaffId} onValueChange={setInstructorStaffId} className="min-w-56">
          <SelectItem value={ALL_INSTRUCTORS}>All instructors</SelectItem>
          {instructors.map((instructor) => (
            <SelectItem key={instructor.id} value={instructor.id}>
              {instructor.name || 'Unnamed staff member'}
            </SelectItem>
          ))}
        </Select>
      </Box>

      {isLoading ? (
        <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
          <Loader />
        </Box>
      ) : isError ? (
        <EmptyState message="Couldn’t load the private lesson schedule." />
      ) : days.length === 0 ? (
        <EmptyState message="No private lessons this week. Closed dates skip lessons automatically." />
      ) : (
        <Box flex={{ direction: 'col', gap: 16 }}>
          {days.map((day) => (
            <Box key={day.dateKey} flex={{ direction: 'col', gap: 8 }}>
              <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-semibold">
                {formatLongDay(day.dateKey)}
              </Text>
              {day.items.map((item) => (
                <ScheduleRow key={`${item.lessonId}:${item.scheduledDate}`} item={item} currency={currency} />
              ))}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};
