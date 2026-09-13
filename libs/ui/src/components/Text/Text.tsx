import type { ElementType, ReactNode } from 'react';
import { resolveColorClass } from '../../theme/resolveColorClass';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveAnimationClasses } from '../../utils/resolveAnimationClasses';
import { resolveMargin, resolvePadding } from '../../utils/resolveSpacing';
import type { ColorSpec } from '../../contracts/color.contract';
import type { AnimationSpec, AnimationTrigger } from '../../tokens/animation';
import type { SpacingProps } from '../../tokens/spacing';

export interface TextProps extends SpacingProps {
  readonly as?: ElementType;
  readonly children: ReactNode;
  readonly textColor?: ColorSpec;
  readonly bgColor?: ColorSpec;
  readonly borderColor?: ColorSpec;
  readonly animation?: AnimationSpec;
  readonly trigger?: AnimationTrigger;
  readonly className?: string;
}

export const Text = ({
  as: Component = 'span',
  children,
  textColor,
  bgColor,
  borderColor,
  animation,
  trigger = 'entrance',
  margin,
  padding,
  className,
}: TextProps) => {
  const classes = mergeClassNames(
    resolveColorClass('text', textColor),
    resolveColorClass('bg', bgColor),
    // border-color utilities are inert without a border-width utility alongside them.
    borderColor && 'border',
    resolveColorClass('border', borderColor),
    resolveAnimationClasses(animation, trigger),
    resolveMargin(margin),
    resolvePadding(padding),
    className,
  );

  return <Component className={classes}>{children}</Component>;
};
