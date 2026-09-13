import type { ElementType, ReactNode } from 'react';
import { Box } from '../Box/Box';
import { resolveColorClass } from '../../theme/resolveColorClass';
import { mergeClassNames } from '../../theme/mergeClassNames';
import type { ColorSpec } from '../../contracts/color.contract';
import type { SpacingProp } from '../../tokens/spacing';

export interface CardProps {
  readonly media?: ReactNode;
  readonly children: ReactNode;
  readonly borderColor?: ColorSpec;
  readonly padding?: SpacingProp;
  readonly onClick?: () => void;
  readonly className?: string;
}

const DEFAULT_BORDER_COLOR: ColorSpec = { color: 'surface', intensity: 300 };
const DEFAULT_PADDING: SpacingProp = { base: 16 };

// A generic shell, not a "PostCard" - the one genuinely reusable mechanic is `media` bleeding
// edge-to-edge through the card's rounded corners (a banner/image sitting flush against the top
// while the body below stays padded). Everything else (title, excerpt, divider, footer row) is
// composed by the caller as `children` using existing Box/Text/Divider/Pill, rather than a shape
// this component guesses from a single consumer.
export const Card = ({
  media,
  children,
  borderColor = DEFAULT_BORDER_COLOR,
  padding = DEFAULT_PADDING,
  onClick,
  className,
}: CardProps) => {
  const Component: ElementType = onClick ? 'button' : 'div';

  const classes = mergeClassNames(
    'block w-full overflow-hidden rounded-lg border text-left',
    resolveColorClass('border', borderColor),
    onClick && 'cursor-pointer',
    className,
  );

  return (
    <Component className={classes} onClick={onClick} type={onClick ? 'button' : undefined}>
      {media}
      <Box padding={padding}>{children}</Box>
    </Component>
  );
};
