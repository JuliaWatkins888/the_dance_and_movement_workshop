import { useEffect, useSyncExternalStore } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveAnimationClasses } from '../../utils/resolveAnimationClasses';
import { resolveAnimationDurationMs } from '../../utils/resolveAnimationDurationMs';
import { resolveDrawerAnimation } from '../../utils/resolveDrawerAnimation';
import {
  subscribeToDrawers,
  getDrawerRecords,
  requestDrawerClose,
  removeDrawer,
  type DrawerRecord,
} from '../../drawer/drawerStore';
import { Drawer } from '../Drawer/Drawer';
import type { AnimationSpec, AnimationTrigger } from '../../tokens/animation';
import type { DrawerSide } from '../../tokens/drawer';

// Always fadeIn/fadeOut, never customizable - only the panel's own animation is (see Drawer's
// `animation` prop), matching Dialog's overlay being a fixed part of the design rather than a
// per-drawer choice.
const OVERLAY_ANIMATION: AnimationSpec = { entrance: 'animate__fadeIn', exit: 'animate__fadeOut' };

// Unlike Dialog's overlay (which centers its content), the drawer's overlay pins its content to
// the edge the panel belongs to and stretches it to full height via flex's default
// align-items: stretch.
const overlayClasses = (side: DrawerSide, trigger: AnimationTrigger) =>
  mergeClassNames(
    'fixed inset-0 z-[200] flex bg-slate-950/50 backdrop-blur-xs',
    side === 'left' ? 'justify-start' : 'justify-end',
    resolveAnimationClasses(OVERLAY_ANIMATION, trigger),
  );

// One per record, bridging the store's `closing` flag to Radix's open/onOpenChange contract
// and to Drawer's `trigger` prop - the same pattern DialogContainer uses for Dialog. Kept as
// its own component so its effect below follows normal per-item hook rules.
const DrawerPortalItem = ({ record }: { readonly record: DrawerRecord }) => {
  const trigger: AnimationTrigger = record.closing ? 'exit' : 'entrance';
  const effectiveAnimation = resolveDrawerAnimation(record.side, record.animation);

  const handleClose = () => requestDrawerClose(record.id);

  // The store only ever marks a record "closing" - actually removing it (and firing the
  // caller's own onClose from drawer.show(..., { onClose })) waits here until the exit
  // animation has had time to play.
  useEffect(() => {
    if (!record.closing) return undefined;
    const timer = setTimeout(() => removeDrawer(record.id), resolveAnimationDurationMs(effectiveAnimation));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.closing, record.id]);

  return (
    <DialogPrimitive.Root
      open={!record.closing}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClasses(record.side, trigger)}>
          <DialogPrimitive.Content
            onEscapeKeyDown={(event) => {
              if (!record.closeOnEscape) event.preventDefault();
            }}
            onInteractOutside={(event) => {
              if (!record.closeOnOverlayClick) event.preventDefault();
            }}
            className="h-full outline-none"
          >
            <Drawer
              side={record.side}
              width={record.width}
              closeable={record.closeable}
              onClose={handleClose}
              animation={record.animation}
              trigger={trigger}
            >
              <DialogPrimitive.Title className={record.title ? 'pr-6 text-lg font-semibold text-surface-900' : 'sr-only'}>
                {record.title ?? 'Drawer'}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className={record.description ? 'text-sm text-surface-600' : 'sr-only'}>
                {record.description ?? ''}
              </DialogPrimitive.Description>

              {typeof record.content === 'function' ? record.content({ close: handleClose }) : record.content}
            </Drawer>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

// Mount once, high in the component tree (see the root App component). This is the only thing
// that needs a fixed spot - `drawer.show()` can be called from anywhere regardless of where
// this renders, since it only ever touches the module-level store in
// ../../drawer/drawerStore.ts. Handles the overlay, edge alignment, portal rendering, focus
// trap, and Escape/outside-click dismissal via Radix; multiple simultaneously-open drawers
// stack naturally (each is its own independent Root/Overlay/Content, later ones painting on top).
export const DrawerContainer = () => {
  const records = useSyncExternalStore(subscribeToDrawers, getDrawerRecords, getDrawerRecords);

  return (
    <>
      {records.map((record) => (
        <DrawerPortalItem key={record.id} record={record} />
      ))}
    </>
  );
};
