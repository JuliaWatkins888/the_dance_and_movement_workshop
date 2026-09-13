export const COLOR_INTENSITIES = [100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type ColorIntensity = (typeof COLOR_INTENSITIES)[number];

export const COLOR_OPACITIES = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;
export type ColorOpacity = (typeof COLOR_OPACITIES)[number];

export const SEMANTIC_COLOR_TOKENS = [
  'primary',
  'secondary',
  'tertiary',
  'quaternary',
  'accent',
  'surface',
  'primary-foreground',
  'secondary-foreground',
  'tertiary-foreground',
  'quaternary-foreground',
  'accent-foreground',
  'surface-foreground',
] as const;
export type SemanticColorToken = (typeof SEMANTIC_COLOR_TOKENS)[number];

export const isSemanticColorToken = (color: string): color is SemanticColorToken =>
  (SEMANTIC_COLOR_TOKENS as readonly string[]).includes(color);

// Tailwind utility prefixes that consume a "<prefix>-<color>-<shade>" class, shared by
// both built-in palette colors and semantic tokens once the latter are registered as
// CSS variables under Tailwind's `--color-*` theme namespace (see theme/theme.css).
export const COLOR_UTILITY_PREFIXES = [
  'text',
  'bg',
  'border',
  'ring',
  'ring-offset',
  'divide',
  'outline',
  'decoration',
  'accent',
  'caret',
  'fill',
  'stroke',
  'from',
  'via',
  'to',
] as const;
export type ColorUtilityPrefix = (typeof COLOR_UTILITY_PREFIXES)[number];

export interface ColorSpec {
  readonly color: string;
  readonly intensity?: ColorIntensity;
  readonly opacity?: ColorOpacity;
}

// Shared by ColorPicker (an existing free-text hex field) and anything else that accepts a raw
// hex string rather than a semantic ColorSpec token - e.g. the CMS's brand-color settings, which
// let an admin type any hex to become a token's 500 intensity (see utils/generateColorScale.ts).
export const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
