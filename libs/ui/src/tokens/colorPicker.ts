// The six brand-facing semantic tokens ColorPicker's "Theme" tab offers as swatches, in this
// exact order - the *-foreground tokens are excluded since those exist for text contrast, not
// as pickable content colors in their own right. Six (not four) so the grid - grid-cols-6, see
// composites/ColorPicker.tsx - fills a complete, evenly spaced row.
export const THEME_SWATCH_COLORS = ['primary', 'secondary', 'tertiary', 'quaternary', 'accent', 'surface'] as const;
export type ThemeSwatchColor = (typeof THEME_SWATCH_COLORS)[number];

// Mirrors the Tailwind palette family list safelisted in theme.css's second `@source
// inline(...)` block - keep these two lists in sync if that block's family list ever changes.
export const TAILWIND_SWATCH_COLORS = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
] as const;
export type TailwindSwatchColor = (typeof TAILWIND_SWATCH_COLORS)[number];
