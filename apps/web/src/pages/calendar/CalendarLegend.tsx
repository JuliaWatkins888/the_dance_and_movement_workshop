import type { CalendarItemCategory } from '@inithium/api-client';
import { CALENDAR_CATEGORIES } from './calendarFormat';

export interface CalendarLegendProps {
  readonly hidden: ReadonlySet<CalendarItemCategory>;
  readonly onToggle: (category: CalendarItemCategory) => void;
}

// The color key doubles as the show/hide toggles.
export const CalendarLegend = ({ hidden, onToggle }: CalendarLegendProps) => (
  <div role="group" aria-label="Show on calendar" className="flex flex-row flex-wrap gap-2">
    {CALENDAR_CATEGORIES.map(({ category, label, color }) => {
      const isShown = !hidden.has(category);
      return (
        <button
          key={category}
          type="button"
          aria-pressed={isShown}
          onClick={() => onToggle(category)}
          className={`flex items-center gap-2 rounded-full border border-surface-300 px-3 py-1 text-sm transition-opacity hover:border-accent-500 focus-visible:outline-2 focus-visible:outline-accent-500 ${
            isShown ? 'text-surface-950' : 'text-surface-600 opacity-60'
          }`}
        >
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-full border-2"
            style={{
              borderColor: `var(--color-${color}-500)`,
              backgroundColor: isShown ? `var(--color-${color}-500)` : 'transparent',
            }}
          />
          {label}
        </button>
      );
    })}
  </div>
);
