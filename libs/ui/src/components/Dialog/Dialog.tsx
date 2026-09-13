import type { CSSProperties, ReactNode } from 'react';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveAnimationClasses } from '../../utils/resolveAnimationClasses';
import { Icon } from '../Icon/Icon';
import type { AnimationSpec, AnimationTrigger } from '../../tokens/animation';

export interface DialogProps {
  readonly children: ReactNode;
  readonly width?: number | string;
  readonly height?: number | string;
  readonly closeable?: boolean;
  readonly onClose?: () => void;
  readonly animation?: AnimationSpec;
  // Mirrors Alert's own `trigger` prop (see components/Alert/Alert.tsx): the caller decides
  // when this is entering vs. exiting rather than an internal state machine.
  readonly trigger?: AnimationTrigger;
  readonly className?: string;
  // Escape hatch merged under the computed width/height (which always win on conflict) -
  // DialogContainer uses this to stagger the content's entrance after the overlay's via
  // `animationDelay`, since that only has an effect on the element actually running the
  // animation (this one), not on an ancestor.
  readonly style?: CSSProperties;
}

export const DEFAULT_DIALOG_ANIMATION: AnimationSpec = { entrance: 'animate__zoomIn', exit: 'animate__zoomOut' };

const DEFAULT_WIDTH = '28rem';

const toCssSize = (value: number | string): string => (typeof value === 'number' ? `${value}px` : value);

// The content card only - not the full-screen overlay, not the centering, not the portal, and
// deliberately no Radix dependency of its own (no Dialog.Title/Description here - those need a
// Dialog.Root ancestor and would throw if this were ever rendered standalone). That orchestration
// is DialogContainer's job (see components/DialogContainer/DialogContainer.tsx), the same split
// as Alert/AlertContainer: this stays usable on its own - wrapped directly in a caller's own
// Radix Dialog.Root/Portal/Overlay for full manual control - while DialogContainer is what the
// global `dialog.show(...)`/`dialog.confirm(...)` API actually renders.
//
// No title/description props either, on purpose: `children` is the entire content surface, so
// a caller who wants a heading just puts a `<Text as="h2">` in there like anywhere else in this
// package. `dialog.show(content, { title, description })` (see ../../dialog/dialogStore.ts)
// covers the common case at the store/DialogContainer layer instead, where Radix's own
// Title/Description requirement already has to be satisfied regardless.
export const Dialog = ({
  children,
  width = DEFAULT_WIDTH,
  height,
  closeable = true,
  onClose,
  animation,
  trigger = 'entrance',
  className,
  style,
}: DialogProps) => {
  const effectiveAnimation = animation ?? DEFAULT_DIALOG_ANIMATION;

  const resolvedStyle: CSSProperties = {
    ...style,
    width: toCssSize(width),
    ...(height !== undefined ? { height: toCssSize(height) } : {}),
  };

  const classes = mergeClassNames(
    'relative flex max-h-[90vh] max-w-[90vw] flex-col gap-3 overflow-auto rounded-lg border border-surface-300 bg-surface-100 p-6 shadow-xl outline-none',
    resolveAnimationClasses(effectiveAnimation, trigger),
    className,
  );

  return (
    <div style={resolvedStyle} className={classes}>
      {closeable && (
        <button
          type="button"
          onClick={() => onClose?.()}
          aria-label="Close"
          className="absolute right-3 top-3 rounded p-1 text-surface-950 transition-colors hover:text-surface-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <Icon as="span" name="X" size={18} />
        </button>
      )}

      {children}
    </div>
  );
};
