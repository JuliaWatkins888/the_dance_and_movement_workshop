import type { CSSProperties } from 'react';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveColorClass } from '../../theme/resolveColorClass';
import { resolveMargin, resolvePadding } from '../../utils/resolveSpacing';
import type { ColorSpec } from '../../contracts/color.contract';
import type { SpacingProps } from '../../tokens/spacing';

export interface DividerProps extends SpacingProps {
  readonly color?: ColorSpec;
  // Stroke thickness in px - a continuous value, not a fixed Tailwind step, so it's applied
  // via inline style the same way Dialog/Drawer/Avatar handle their own arbitrary px props.
  readonly thickness?: number;
  // The rule's own length. Same number-or-string/toCssSize contract as Dialog's width.
  readonly width?: number | string;
  readonly className?: string;
}

const DEFAULT_COLOR: ColorSpec = { color: 'surface', intensity: 300 };
const DEFAULT_THICKNESS = 1;
const DEFAULT_WIDTH = '100%';

const toCssSize = (value: number | string): string => (typeof value === 'number' ? `${value}px` : value);

// A plain <hr> rather than a styled <div> - its implicit ARIA role is already `separator`, so
// no Radix primitive or manual role wiring is needed. Tailwind's Preflight already resets <hr>
// to `height: 0; border-top-width: 1px` (zeroing every other side), so only the top border is
// ever visible - `thickness` and `color` just override that single edge.
export const Divider = ({
  color = DEFAULT_COLOR,
  thickness = DEFAULT_THICKNESS,
  width = DEFAULT_WIDTH,
  margin,
  padding,
  className,
}: DividerProps) => {
  const style: CSSProperties = {
    width: toCssSize(width),
    borderTopWidth: `${thickness}px`,
  };

  const classes = mergeClassNames(
    resolveColorClass('border', color),
    resolveMargin(margin),
    resolvePadding(padding),
    className,
  );

  return <hr style={style} className={classes} />;
};
