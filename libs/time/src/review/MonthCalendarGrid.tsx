import { Box, Icon, Pill, Text, resolveContrastColor } from '@inithium/ui';
import type { ColorSpec } from '@inithium/ui';
import type { TimeEntryDto, TimeEntryTypeDto } from '@inithium/api-client';
import { formatClockTime, formatOrdinalDate, getMonthGridDays, getMonthLeadingBlankCount, zonedDateKey } from '../timeDateUtils';

export interface MonthCalendarGridProps {
  readonly monthAnchor: Date;
  readonly entries: TimeEntryDto[];
  readonly types: TimeEntryTypeDto[];
  readonly timeZone: string;
  readonly onDayClick: (dateKey: string) => void;
  readonly onEntryClick: (entry: TimeEntryDto) => void;
  // Colors each entry's pill by whatever this returns - used only by the "All Employees" review
  // view (see employeeColors.ts) to tell employees apart at a glance. Defaults to a flat brand
  // color when omitted (the single-employee view, where color doesn't need to carry any meaning).
  readonly getEntryColor?: (entry: TimeEntryDto) => ColorSpec;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_ENTRY_COLOR: ColorSpec = { color: 'primary', intensity: 500 };

// The one genuinely new UI composite this plugin needs - no calendar primitive exists in core
// @inithium/ui. It lives here (inside libs/time), not promoted up to libs/ui: nothing else in
// this codebase needs a generic calendar yet, so building a speculative reusable abstraction now
// would be guessing at a shape with no second consumer to validate it against - promote it later
// if one shows up. Renders two layouts (a real 7-column grid, and a stacked day list) rather than
// one responsive grid, since a 7-column grid is unusable at phone width and this plugin's device
// context is primarily employee phones.
export const MonthCalendarGrid = ({ monthAnchor, entries, types, timeZone, onDayClick, onEntryClick, getEntryColor }: MonthCalendarGridProps) => {
  const labelById = new Map(types.map((type) => [type.id, type.label]));
  const entriesByDay = new Map<string, TimeEntryDto[]>();
  for (const entry of entries) {
    const key = zonedDateKey(entry.startAt, timeZone);
    entriesByDay.set(key, [...(entriesByDay.get(key) ?? []), entry]);
  }

  const days = getMonthGridDays(monthAnchor);
  const leadingBlanks = getMonthLeadingBlankCount(monthAnchor);

  const renderEntryPill = (entry: TimeEntryDto) => {
    const color = getEntryColor?.(entry) ?? DEFAULT_ENTRY_COLOR;
    return (
      <button
        key={entry.id}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onEntryClick(entry);
        }}
        className="block w-full text-left"
      >
        <Pill color={color} className="flex w-full items-center gap-1 truncate">
          {entry.locked ? <Icon as="span" name="Lock" size={10} textColor={resolveContrastColor(color)} /> : null}
          <Text as="span" textColor={resolveContrastColor(color)} className="truncate text-xs font-medium">
            {formatClockTime(entry.startAt, timeZone)} {labelById.get(entry.typeId) ?? ''}
          </Text>
        </Pill>
      </button>
    );
  };

  return (
    <Box flex={{ direction: 'col' }}>
      <Box className="hidden overflow-x-auto sm:block">
        <Box className="grid grid-cols-7 gap-px" bgColor={{ color: 'surface', intensity: 200 }}>
          {WEEKDAY_LABELS.map((label) => (
            <Box key={label} bgColor={{ color: 'surface', intensity: 100 }} padding={{ base: 8 }}>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs font-medium">
                {label}
              </Text>
            </Box>
          ))}
          {Array.from({ length: leadingBlanks }, (_, index) => (
            <Box key={`blank-${index}`} bgColor={{ color: 'surface', intensity: 100 }} />
          ))}
          {days.map((day) => (
            <button key={day.dateKey} type="button" onClick={() => onDayClick(day.dateKey)} className="text-left">
              <Box
                bgColor={{ color: 'surface', intensity: 100 }}
                padding={{ base: 6 }}
                flex={{ direction: 'col', gap: 4 }}
                className="hover:bg-surface-200 min-h-24 w-full cursor-pointer"
              >
                <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-xs">
                  {day.dayOfMonth}
                </Text>
                {(entriesByDay.get(day.dateKey) ?? []).map(renderEntryPill)}
              </Box>
            </button>
          ))}
        </Box>
      </Box>

      <Box flex={{ direction: 'col', gap: 8 }} className="sm:hidden">
        {days.map((day) => {
          const dayEntries = entriesByDay.get(day.dateKey) ?? [];
          return (
            <button key={day.dateKey} type="button" onClick={() => onDayClick(day.dateKey)} className="text-left">
              <Box
                borderColor={{ color: 'surface', intensity: 200 }}
                padding={{ base: 12 }}
                flex={{ direction: 'col', gap: 6 }}
                className="w-full rounded border"
              >
                <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm font-medium">
                  {formatOrdinalDate(day.dateKey)}
                </Text>
                {dayEntries.length > 0 ? (
                  <Box flex={{ direction: 'col', gap: 4 }}>{dayEntries.map(renderEntryPill)}</Box>
                ) : (
                  <Text as="span" textColor={{ color: 'surface', intensity: 500 }} className="text-xs">
                    No entries
                  </Text>
                )}
              </Box>
            </button>
          );
        })}
      </Box>
    </Box>
  );
};
