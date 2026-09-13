import type { AnimationSpec, AnimationTrigger } from '../tokens/animation';

const DEFAULT_ENTRANCE = 'animate__fadeIn';
const DEFAULT_EXIT = 'animate__fadeOut';
const DEFAULT_SPEED = 'animate__fast';

export const resolveAnimationClasses = (
  spec: AnimationSpec | undefined,
  trigger: AnimationTrigger,
): string | undefined => {
  if (!spec) return undefined;

  const animation = trigger === 'entrance' ? (spec.entrance ?? DEFAULT_ENTRANCE) : (spec.exit ?? DEFAULT_EXIT);

  return ['animate__animated', animation, spec.delay, spec.speed ?? DEFAULT_SPEED, spec.repeat]
    .filter(Boolean)
    .join(' ');
};
