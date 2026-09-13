import type { ElementType } from 'react';
import { resolveColorClass } from '../../theme/resolveColorClass';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveAnimationClasses } from '../../utils/resolveAnimationClasses';
import { resolveMargin, resolvePadding } from '../../utils/resolveSpacing';
import { resolvePhosphorIcon } from '../../utils/resolvePhosphorIcon';
import type { ColorSpec } from '../../contracts/color.contract';
import type { AnimationSpec, AnimationTrigger } from '../../tokens/animation';
import type { SpacingProps } from '../../tokens/spacing';
import type { IconName, IconWeight } from '../../tokens/icon';

export interface IconProps extends SpacingProps {
  readonly as?: ElementType;
  readonly name: IconName;
  readonly size?: number | string;
  readonly weight?: IconWeight;
  readonly mirrored?: boolean;
  readonly bgColor?: ColorSpec;
  readonly textColor?: ColorSpec;
  readonly borderColor?: ColorSpec;
  readonly animation?: AnimationSpec;
  readonly trigger?: AnimationTrigger;
  readonly className?: string;
}

// bgColor/borderColor/animation/spacing land on the wrapper, not the <svg> itself, since a
// bare svg has no background/border box of its own. textColor lands on that same wrapper and
// reaches the glyph purely through CSS inheritance: Phosphor's icons render `fill="currentColor"`
// by default (see @phosphor-icons/react's IconBase), so a Tailwind `text-*` class here colors
// the glyph's actual paths, not any text - Icon renders no text node at all.
export const Icon = ({
  as: Component = 'div',
  name,
  size,
  weight,
  mirrored,
  bgColor,
  textColor,
  borderColor,
  animation,
  trigger = 'entrance',
  margin,
  padding,
  className,
}: IconProps) => {
  const PhosphorIcon = resolvePhosphorIcon(name);

  const classes = mergeClassNames(
    'flex flex-col items-center justify-center',
    resolveColorClass('bg', bgColor),
    // border-color utilities are inert without a border-width utility alongside them.
    borderColor && 'border',
    resolveColorClass('border', borderColor),
    resolveAnimationClasses(animation, trigger),
    resolveMargin(margin),
    resolvePadding(padding),
    className,
  );

  return (
    <Component className={classes}>
      <PhosphorIcon size={size} weight={weight} mirrored={mirrored} />
    </Component>
  );
};
