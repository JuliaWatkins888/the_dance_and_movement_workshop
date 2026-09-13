import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveAnimationClasses } from '../../utils/resolveAnimationClasses';
import type { AnimationSpec, AnimationTrigger } from '../../tokens/animation';
import { Box, type BoxProps } from '../Box/Box';

export interface AnimateBoxProps extends BoxProps {
  readonly animation?: AnimationSpec;
  readonly trigger?: AnimationTrigger;
}

export const AnimateBox = ({
  animation,
  trigger = 'entrance',
  className,
  ...boxProps
}: AnimateBoxProps) => {
  const classes = mergeClassNames(resolveAnimationClasses(animation, trigger), className);

  return <Box {...boxProps} className={classes} />;
};
