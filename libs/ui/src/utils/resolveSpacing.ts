import type { DirectionalSpacing, SpacingProp } from '../tokens/spacing';

type SpacingPrefix = 'm' | 'p';
type Direction = keyof Omit<DirectionalSpacing, 'base'>;

const DIRECTIONS: ReadonlyArray<{ readonly key: Direction; readonly suffix: string }> = [
  { key: 'top', suffix: 't' },
  { key: 'right', suffix: 'r' },
  { key: 'bottom', suffix: 'b' },
  { key: 'left', suffix: 'l' },
];

// Directional overrides always win over `base`; when none are set, `base` collapses
// to a single shorthand class instead of four identical directional ones.
const resolveSpacing = (prefix: SpacingPrefix, spacing: SpacingProp | undefined): string => {
  if (spacing === undefined) return '';
  if (typeof spacing === 'number') return `${prefix}-[${spacing}px]`;

  const { base } = spacing;
  const hasDirectionalOverride = DIRECTIONS.some(({ key }) => spacing[key] !== undefined);

  if (!hasDirectionalOverride) {
    return base !== undefined ? `${prefix}-[${base}px]` : '';
  }

  return DIRECTIONS.map(({ key, suffix }) => {
    const value = spacing[key] ?? base;
    return value !== undefined ? `${prefix}${suffix}-[${value}px]` : undefined;
  })
    .filter(Boolean)
    .join(' ');
};

export const resolveMargin = (spacing?: SpacingProp): string => resolveSpacing('m', spacing);
export const resolvePadding = (spacing?: SpacingProp): string => resolveSpacing('p', spacing);
