import { useMemo, useState } from 'react';
import { Box, EventCalendar, Text, dialog, useNavigateWithTransition } from '@inithium/ui';
import type { EventCalendarItem, EventCalendarRange } from '@inithium/ui';
import { useGetCalendarQuery } from '@inithium/api-client';
import type { CalendarItemCategory, CalendarItemDto, CalendarRangeArgs } from '@inithium/api-client';
import { NAVBAR_HEIGHT } from '../app/navbarHeight';
import { CalendarItemDetails } from './calendar/CalendarItemDetails';
import { CalendarLegend } from './calendar/CalendarLegend';
import { colorOfCategory, displayTitle, toLocalDateKey } from './calendar/calendarFormat';

// Fills the viewport under the navbar, but never so short the month grid becomes unreadable.
const PAGE_HEIGHT = `max(560px, calc(100dvh - ${NAVBAR_HEIGHT}px))`;

const toCalendarItem = (item: CalendarItemDto): EventCalendarItem => ({
  id: item.id,
  title: displayTitle(item),
  ...(item.subtitle ? { subtitle: item.subtitle } : {}),
  start: item.start,
  ...(item.end ? { end: item.end } : {}),
  allDay: item.allDay,
  color: colorOfCategory(item.category),
});

export const CalendarPage = () => {
  const navigate = useNavigateWithTransition();
  const [range, setRange] = useState<CalendarRangeArgs | undefined>(undefined);
  const [hidden, setHidden] = useState<ReadonlySet<CalendarItemCategory>>(new Set());
  // `data` keeps the previous range's items while the next range loads, so the grid never blanks.
  const { data: items = [], isFetching, isError } = useGetCalendarQuery(range ?? { from: '', to: '' }, { skip: !range });

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const visibleItems = useMemo(
    () => items.filter((item) => !hidden.has(item.category)).map(toCalendarItem),
    [items, hidden],
  );

  const handleRangeChange = ({ start, end }: EventCalendarRange) => setRange({ from: toLocalDateKey(start), to: toLocalDateKey(end) });

  const toggleCategory = (category: CalendarItemCategory) =>
    setHidden((previous) => {
      const next = new Set(previous);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  const handleItemClick = (id: string) => {
    const item = itemsById.get(id);
    if (!item) return;
    if (item.href) {
      navigate(item.href);
      return;
    }
    dialog.show(({ close }) => <CalendarItemDetails item={item} close={close} />, { title: item.title });
  };

  return (
    <Box padding={{ base: 16 }} flex={{ direction: 'col', gap: 8 }} className="w-full md:px-6" style={{ height: PAGE_HEIGHT }}>
      <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="sr-only">
        Studio Calendar
      </Text>
      {isError ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
          The calendar couldn’t be loaded. Please try again in a moment.
        </Text>
      ) : null}
      <EventCalendar
        items={visibleItems}
        initialView="month"
        onRangeChange={handleRangeChange}
        onItemClick={handleItemClick}
        isLoading={isFetching}
        toolbarExtra={<CalendarLegend hidden={hidden} onToggle={toggleCategory} />}
        className="flex-1"
      />
    </Box>
  );
};
