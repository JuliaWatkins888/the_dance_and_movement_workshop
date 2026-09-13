import type { AnimationSpec, AnimSpeed } from '../tokens/animation';

// animate.css's own duration per speed modifier class. resolveAnimationClasses defaults to
// 'animate__fast' when a spec has no explicit speed - anything that needs to keep a closing
// element mounted long enough for its exit animation to actually play (AlertContainer,
// DialogContainer) needs that same duration in milliseconds to time the eventual removal.
const SPEED_MS: Record<AnimSpeed, number> = {
  animate__slower: 3000,
  animate__slow: 2000,
  animate__fast: 800,
  animate__faster: 500,
};
const DEFAULT_SPEED_MS = SPEED_MS.animate__fast;

export const resolveAnimationDurationMs = (animation: AnimationSpec): number =>
  animation.speed ? SPEED_MS[animation.speed] : DEFAULT_SPEED_MS;
