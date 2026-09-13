import type { ReactNode } from 'react';
import { resolveColorClass } from '../../theme/resolveColorClass';
import { mergeClassNames } from '../../theme/mergeClassNames';
import type { ColorSpec } from '../../contracts/color.contract';

export interface PillProps {
  readonly children: ReactNode;
  readonly color?: ColorSpec;
  readonly className?: string;
}

const DEFAULT_COLOR: ColorSpec = { color: 'surface', intensity: 100, opacity: 80 };

// A pure visual chip - absolute/relative positioning (e.g. a category pill floated over a
// Banner) is the caller's responsibility, the same position-agnostic contract Icon/Avatar use.
export const Pill = ({ children, color = DEFAULT_COLOR, className }: PillProps) => {
  const classes = mergeClassNames(
    'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
    resolveColorClass('bg', color),
    className,
  );

  return <span className={classes}>{children}</span>;
};
