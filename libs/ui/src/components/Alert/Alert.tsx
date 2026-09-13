import { useEffect, type ReactNode } from 'react';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveAnimationClasses } from '../../utils/resolveAnimationClasses';
import { resolveAlertSeverityClasses } from '../../utils/resolveAlertSeverityClasses';
import { resolveAlertAnimation } from '../../utils/resolveAlertAnimation';
import { Icon } from '../Icon/Icon';
import type { AnimationSpec, AnimationTrigger } from '../../tokens/animation';
import type { AlertPosition, AlertSeverity } from '../../tokens/alert';

export interface AlertProps {
  readonly message: string | ReactNode;
  readonly severity?: AlertSeverity;
  readonly position?: AlertPosition;
  readonly closeable?: boolean;
  readonly duration?: number;
  readonly onClose?: () => void;
  readonly animation?: AnimationSpec;
  // Mirrors AnimateBox/Text/Icon's own `trigger` prop rather than an internal "closing" state
  // machine: the caller decides when this is entering vs. exiting (AlertContainer flips it to
  // 'exit' before it actually unmounts a dismissed alert), this just resolves whichever is
  // active into the right classes.
  readonly trigger?: AnimationTrigger;
  readonly className?: string;
}

// Fully usable standalone - with no AlertContainer/global store involved at all, `duration`
// alone still fires `onClose` after that many ms via the effect below. `position` only picks
// the default animation direction here (see resolveAlertAnimation); actual fixed screen
// placement and stacking is AlertContainer's job, not this component's - rendering N alerts
// all `position="top-right"` side by side is meaningless unless something else arranges them.
export const Alert = ({
  message,
  severity = 'default',
  position = 'top-right',
  closeable = true,
  duration = 5000,
  onClose,
  animation,
  trigger = 'entrance',
  className,
}: AlertProps) => {
  useEffect(() => {
    if (duration <= 0) return undefined;
    const timer = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const classes = mergeClassNames(
    'flex w-full max-w-sm items-start gap-3 rounded-md border p-4 shadow-md',
    resolveAlertSeverityClasses(severity),
    resolveAnimationClasses(resolveAlertAnimation(position, animation), trigger),
    className,
  );

  return (
    <div role="status" aria-live="polite" className={classes}>
      <div className="flex-1 text-sm">{message}</div>
      {closeable && (
        <button
          type="button"
          onClick={() => onClose?.()}
          aria-label="Dismiss"
          className="shrink-0 rounded p-0.5 text-current opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <Icon as="span" name="X" size={16} />
        </button>
      )}
    </div>
  );
};
