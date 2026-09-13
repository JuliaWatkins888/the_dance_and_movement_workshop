import type { ColorSpec } from '@inithium/ui';

// The theme's 5 raw brand colors (see CLAUDE.md §5) - used first, in order, since they're this
// app's own branding and the most visually distinct from each other by design. Only used for the
// "All Employees" review view's color key; a single-employee view has no need to tell employees
// apart by color.
const THEME_COLORS: ColorSpec['color'][] = ['primary', 'secondary', 'tertiary', 'quaternary', 'accent'];

// Once every theme color is claimed, fall back to plain Tailwind hues - still distinct from each
// other and from the theme colors, just not brand-carrying. Cycles (via modulo) rather than
// erroring past this list's length, however many employees exist.
const FALLBACK_TAILWIND_COLORS: ColorSpec['color'][] = [
  'rose',
  'emerald',
  'amber',
  'indigo',
  'cyan',
  'lime',
  'fuchsia',
  'orange',
  'teal',
  'sky',
];

const colorForIndex = (index: number): ColorSpec['color'] =>
  index < THEME_COLORS.length ? THEME_COLORS[index] : FALLBACK_TAILWIND_COLORS[(index - THEME_COLORS.length) % FALLBACK_TAILWIND_COLORS.length];

// Stable per-employee color assignment for the "All Employees" review calendar - built once from
// whatever order the employee list arrives in (the same order the legend renders in), so a given
// employee keeps the same color across the legend, the calendar pills, and re-renders.
export const buildEmployeeColorMap = (employeeIds: string[]): Map<string, ColorSpec> =>
  new Map(employeeIds.map((id, index) => [id, { color: colorForIndex(index), intensity: 500 }]));
