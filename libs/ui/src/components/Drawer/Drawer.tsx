import type { CSSProperties, ReactNode } from 'react';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveAnimationClasses } from '../../utils/resolveAnimationClasses';
import { resolveDrawerAnimation } from '../../utils/resolveDrawerAnimation';
import { Icon } from '../Icon/Icon';
import type { AnimationSpec, AnimationTrigger } from '../../tokens/animation';
import type { DrawerSide } from '../../tokens/drawer';

export interface DrawerProps {
  readonly children: ReactNode;
  readonly side?: DrawerSide;
  readonly width?: number | string;
  readonly closeable?: boolean;
  readonly onClose?: () => void;
  readonly animation?: AnimationSpec;
  // Mirrors Dialog/Alert's own `trigger` prop: the caller decides when this is entering vs.
  // exiting rather than an internal state machine.
  readonly trigger?: AnimationTrigger;
  readonly className?: string;
  readonly style?: CSSProperties;
}

const DEFAULT_WIDTH = '28rem';

const toCssSize = (value: number | string): string => (typeof value === 'number' ? `${value}px` : value);

// The panel only - not the full-screen overlay, not the edge alignment, not the portal, and
// deliberately no Radix dependency of its own (no Dialog.Title/Description here - those need a
// Dialog.Root ancestor and would throw if this were ever rendered standalone). That
// orchestration is DrawerContainer's job (see components/DrawerContainer/DrawerContainer.tsx),
// the same split as Dialog/DialogContainer: this stays usable on its own - wrapped directly in
// a caller's own Radix Dialog.Root/Portal/Overlay for full manual control - while
// DrawerContainer is what the global `drawer.show(...)` API actually renders.
export const Drawer = ({
  children,
  side = 'right',
  width = DEFAULT_WIDTH,
  closeable = true,
  onClose,
  animation,
  trigger = 'entrance',
  className,
  style,
}: DrawerProps) => {
  const effectiveAnimation = resolveDrawerAnimation(side, animation);

  const resolvedStyle: CSSProperties = { ...style, width: toCssSize(width) };

  const classes = mergeClassNames(
    'relative flex h-full max-w-[90vw] flex-col gap-3 overflow-auto bg-surface-100 p-6 shadow-2xl outline-none',
    side === 'left' ? 'border-r border-surface-300' : 'border-l border-surface-300',
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
