import type { AnimationSpec } from '../tokens/animation';
import type { DrawerSide } from '../tokens/drawer';

// A drawer visually belongs to the screen edge it's pinned to, so it slides in/out from that
// same edge by default - mirrors resolveAlertAnimation's per-position defaults.
const DEFAULT_ANIMATIONS: Record<DrawerSide, AnimationSpec> = {
  left: { entrance: 'animate__slideInLeft', exit: 'animate__slideOutLeft' },
  right: { entrance: 'animate__slideInRight', exit: 'animate__slideOutRight' },
};

export const resolveDrawerAnimation = (
  side: DrawerSide,
  animation: AnimationSpec | undefined,
): AnimationSpec => animation ?? DEFAULT_ANIMATIONS[side];
