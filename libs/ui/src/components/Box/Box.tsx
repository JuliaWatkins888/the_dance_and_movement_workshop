import type { CSSProperties, ElementType, ReactNode } from 'react';
import { resolveColorClass } from '../../theme/resolveColorClass';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveFlexClasses } from '../../utils/resolveFlexClasses';
import { resolveMargin, resolvePadding } from '../../utils/resolveSpacing';
import type { ColorSpec } from '../../contracts/color.contract';
import type { FlexSpec } from '../../tokens/flex';
import type { SpacingProps } from '../../tokens/spacing';

export interface BoxProps extends SpacingProps {
  readonly as?: ElementType;
  readonly children?: ReactNode;
  readonly bgColor?: ColorSpec;
  readonly borderColor?: ColorSpec;
  readonly flex?: FlexSpec;
  readonly className?: string;
  // Escape hatch for continuous/runtime-computed values (a calc() expression, a CSS custom
  // property override, ...) that can't be expressed as a static Tailwind class — the same
  // inline-style approach Divider/Avatar/Dialog already use for their own arbitrary values.
  readonly style?: CSSProperties;
}

// Matches Tailwind's own border-width utilities ('border', 'border-b', 'border-x-2', ...) -
// used below to tell whether a caller already picked a specific side/width so Box doesn't need
// to fall back to a generic (all-sides) one.
const BORDER_WIDTH_CLASS_PATTERN = /\bborder(-[trblxy])?(-\d+)?\b/;

export const Box = ({
  as: Component = 'div',
  children,
  bgColor,
  borderColor,
  flex,
  margin,
  padding,
  className,
  style,
}: BoxProps) => {
  // border-color utilities are inert without a border-width utility alongside them - but only
  // fall back to the generic (all-sides) 'border' when the caller's own className hasn't already
  // picked a directional one (e.g. 'border-b' for a bottom-only divider): otherwise both apply
  // simultaneously and every side the caller didn't ask for still gets a visible 1px border.
  const hasOwnBorderWidth = className ? BORDER_WIDTH_CLASS_PATTERN.test(className) : false;

  const classes = mergeClassNames(
    resolveColorClass('bg', bgColor),
    borderColor && !hasOwnBorderWidth && 'border',
    resolveColorClass('border', borderColor),
    resolveFlexClasses(flex),
    resolveMargin(margin),
    resolvePadding(padding),
    className,
  );

  return (
    <Component className={classes} style={style}>
      {children}
    </Component>
  );
};
