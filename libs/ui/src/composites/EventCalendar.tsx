import { useMemo, useRef, useState, type ReactNode } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import interactionPlugin from '@fullcalendar/interaction';
import type { DatesSetArg, DayCellContentArg, EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import { Box, Button, IconButton, Loader, Text } from '../components';
import { mergeClassNames } from '../theme/mergeClassNames';

export type EventCalendarView = 'month' | 'week' | 'year';

export interface EventCalendarItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  // Floating wall-clock values with no offset, rendered exactly as given: "YYYY-MM-DD" for an
  // all-day item (end exclusive), otherwise "YYYY-MM-DDTHH:mm".
  readonly start: string;
  readonly end?: string;
  readonly allDay: boolean;
  // Semantic token ('primary', 'accent', ...) the item is painted with at 500; its -foreground
  // partner colors the text.
  readonly color: string;
}

export interface EventCalendarRange {
  // Local midnights; end is exclusive.
  readonly start: Date;
  readonly end: Date;
}

export interface EventCalendarProps {
  readonly items: readonly EventCalendarItem[];
  readonly initialView?: EventCalendarView;
  // Fires with every newly visible range - fetch the items for it here.
  readonly onRangeChange?: (range: EventCalendarRange) => void;
  readonly onItemClick?: (id: string) => void;
  // Month view shows this many items per day before collapsing the rest into "+N more".
  readonly maxItemsPerDay?: number;
  readonly isLoading?: boolean;
  // Rendered under the toolbar (e.g. a legend).
  readonly toolbarExtra?: ReactNode;
  readonly className?: string;
}

const FULLCALENDAR_VIEWS: Record<EventCalendarView, string> = {
  month: 'dayGridMonth',
  week: 'timeGridWeek',
  year: 'multiMonthYear',
};

const VIEW_LABELS: Record<EventCalendarView, string> = { month: 'Month', week: 'Week', year: 'Year' };

const VIEW_ORDER: readonly EventCalendarView[] = ['week', 'month', 'year'];

const PLUGINS = [dayGridPlugin, timeGridPlugin, multiMonthPlugin, interactionPlugin];

const MAX_DOTS_PER_DAY = 5;

const toViewName = (fullCalendarView: string): EventCalendarView =>
  (Object.keys(FULLCALENDAR_VIEWS) as EventCalendarView[]).find((view) => FULLCALENDAR_VIEWS[view] === fullCalendarView) ?? 'month';

const pad = (value: number): string => String(value).padStart(2, '0');

const localDateKey = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const addDaysToKey = (dateKey: string, days: number): string => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return localDateKey(new Date(year, month - 1, day + days));
};

// The date keys an item covers - its all-day end is exclusive, a timed end is inclusive.
const coveredDateKeys = (item: EventCalendarItem): string[] => {
  const startKey = item.start.slice(0, 10);
  const lastKey = item.end ? (item.allDay ? addDaysToKey(item.end.slice(0, 10), -1) : item.end.slice(0, 10)) : startKey;
  const keys: string[] = [];
  for (let key = startKey; key <= lastKey; key = addDaysToKey(key, 1)) keys.push(key);
  return keys;
};

// The distinct colors present on each day, in first-seen order - what the year view's dots show.
const buildDayColors = (items: readonly EventCalendarItem[]): Map<string, string[]> =>
  items.reduce((dayColors, item) => {
    coveredDateKeys(item).forEach((key) => {
      const colors = dayColors.get(key) ?? [];
      if (!colors.includes(item.color)) dayColors.set(key, [...colors, item.color]);
    });
    return dayColors;
  }, new Map<string, string[]>());

// Inline CSS variables rather than utility classes: FullCalendar's own (unlayered) styles would
// outrank Tailwind's layered utilities on its event elements.
const toEventInput = (item: EventCalendarItem): EventInput => ({
  id: item.id,
  title: item.title,
  start: item.start,
  ...(item.end ? { end: item.end } : {}),
  allDay: item.allDay,
  backgroundColor: `var(--color-${item.color}-500)`,
  borderColor: `var(--color-${item.color}-500)`,
  textColor: `var(--color-${item.color}-foreground-500)`,
  extendedProps: { subtitle: item.subtitle },
});

const renderEventContent = (arg: EventContentArg) => {
  const subtitle = arg.event.extendedProps['subtitle'] as string | undefined;
  const isTimeGrid = arg.view.type === FULLCALENDAR_VIEWS.week;
  return (
    <div className={mergeClassNames('ui-calendar-event', isTimeGrid ? 'ui-calendar-event--stacked' : undefined)}>
      {arg.timeText ? <span className="ui-calendar-event-time">{arg.timeText}</span> : null}
      <span className="ui-calendar-event-title">{arg.event.title}</span>
      {isTimeGrid && subtitle ? <span className="ui-calendar-event-subtitle">{subtitle}</span> : null}
    </div>
  );
};

// A general-purpose scheduling calendar over FullCalendar: month, hourly week, and a year of
// mini months where each day shows one dot per item color instead of the items themselves.
// Clicking a day in the year view opens that week. Sizes itself to its container's height.
export const EventCalendar = ({
  items,
  initialView = 'month',
  onRangeChange,
  onItemClick,
  maxItemsPerDay = 3,
  isLoading = false,
  toolbarExtra,
  className,
}: EventCalendarProps) => {
  const calendarRef = useRef<FullCalendar>(null);
  const [view, setView] = useState<EventCalendarView>(initialView);
  const [title, setTitle] = useState('');

  const eventInputs = useMemo(() => items.map(toEventInput), [items]);
  const dayColors = useMemo(() => buildDayColors(items), [items]);

  const api = () => calendarRef.current?.getApi();

  const handleDatesSet = (arg: DatesSetArg) => {
    setTitle(arg.view.title);
    setView(toViewName(arg.view.type));
    onRangeChange?.({ start: arg.start, end: arg.end });
  };

  const handleEventClick = (arg: EventClickArg) => {
    arg.jsEvent.preventDefault();
    onItemClick?.(arg.event.id);
  };

  const handleDateClick = (arg: DateClickArg) => {
    if (arg.view.type === FULLCALENDAR_VIEWS.year) api()?.changeView(FULLCALENDAR_VIEWS.week, arg.date);
  };

  const renderDayCell = (arg: DayCellContentArg) => {
    if (arg.view.type !== FULLCALENDAR_VIEWS.year) return arg.dayNumberText;
    const colors = dayColors.get(localDateKey(arg.date)) ?? [];
    return (
      <div className="ui-calendar-year-day">
        <span>{arg.dayNumberText}</span>
        <span className="ui-calendar-year-dots" aria-hidden="true">
          {colors.slice(0, MAX_DOTS_PER_DAY).map((color) => (
            <span key={color} className="ui-calendar-year-dot" style={{ backgroundColor: `var(--color-${color}-500)` }} />
          ))}
        </span>
      </div>
    );
  };

  return (
    <Box flex={{ direction: 'col', gap: 12 }} className={mergeClassNames('ui-calendar min-h-0', className)}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }} className="flex-wrap">
        <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
          <IconButton icon="CaretLeft" label="Previous" onClick={() => api()?.prev()} />
          <Button variant={{ kind: 'outlined', color: 'primary' }} onClick={() => api()?.today()}>
            Today
          </Button>
          <IconButton icon="CaretRight" label="Next" onClick={() => api()?.next()} />
          <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="ml-2 text-xl font-bold">
            {title}
          </Text>
          {isLoading ? <Loader variant="spinner" size="1.25rem" color={{ color: 'primary', intensity: 500 }} label="Loading" /> : null}
        </Box>
        <div role="group" aria-label="Calendar view" className="flex flex-row gap-1">
          {VIEW_ORDER.map((option) => (
            <Button
              key={option}
              aria-pressed={view === option}
              variant={{ kind: view === option ? 'filled' : 'ghost', color: 'primary' }}
              onClick={() => api()?.changeView(FULLCALENDAR_VIEWS[option])}
            >
              {VIEW_LABELS[option]}
            </Button>
          ))}
        </div>
      </Box>
      {toolbarExtra}
      <div className="min-h-0 flex-1 text-surface-950">
        <FullCalendar
          ref={calendarRef}
          plugins={PLUGINS}
          initialView={FULLCALENDAR_VIEWS[initialView]}
          headerToolbar={false}
          height="100%"
          datesSet={handleDatesSet}
          events={view === 'year' ? [] : eventInputs}
          eventDisplay="block"
          eventContent={renderEventContent}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          dayCellContent={renderDayCell}
          dayMaxEvents={maxItemsPerDay}
          nowIndicator
          scrollTime="08:00:00"
          allDayText="All day"
          views={{ multiMonthYear: { showNonCurrentDates: false, multiMonthMinWidth: 240 } }}
        />
      </div>
    </Box>
  );
};
