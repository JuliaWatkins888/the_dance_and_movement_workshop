import { resolveAnimationDurationMs } from './resolveAnimationDurationMs';
import type { AnimationSpec } from '../tokens/animation';
import type { AlertPosition } from '../tokens/alert';

// Top positions drop into place and float back up on exit; bottom positions rise into place
// and sink back down - entrance/exit mirror the screen edge the alert visually belongs to.
const DEFAULT_ANIMATIONS: Record<AlertPosition, AnimationSpec> = {
  'top-right': { entrance: 'animate__fadeInDown', exit: 'animate__fadeOutUp' },
  'top-left': { entrance: 'animate__fadeInDown', exit: 'animate__fadeOutUp' },
  'bottom-right': { entrance: 'animate__fadeInUp', exit: 'animate__fadeOutDown' },
  'bottom-left': { entrance: 'animate__fadeInUp', exit: 'animate__fadeOutDown' },
};

// Alert is the one primitive in this package with a non-optional default animation - a toast
// that doesn't animate in/out reads as broken, unlike Text/Box/Icon/Button where animation is
// opt-in. `animation` (the public prop) still fully overrides this when supplied.
export const resolveAlertAnimation = (
  position: AlertPosition,
  animation: AnimationSpec | undefined,
): AnimationSpec => animation ?? DEFAULT_ANIMATIONS[position];

// Kept as an Alert-specific alias of the generic resolver (see resolveAnimationDurationMs.ts,
// also used by DialogContainer) so existing imports of this name don't need to change.
export const resolveExitDurationMs = resolveAnimationDurationMs;
