import { useEffect, useSyncExternalStore } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveAnimationClasses } from '../../utils/resolveAnimationClasses';
import { resolveAnimationDurationMs } from '../../utils/resolveAnimationDurationMs';
import {
  subscribeToDialogs,
  getDialogRecords,
  requestDialogClose,
  removeDialog,
  type DialogRecord,
} from '../../dialog/dialogStore';
import { Dialog, DEFAULT_DIALOG_ANIMATION } from '../Dialog/Dialog';
import type { AnimationSpec, AnimationTrigger } from '../../tokens/animation';

// Fixed, not exposed as a prop: the spec is "fade the backdrop in, then less than a second
// later animate the dialog in" as a baked-in sequencing detail, not a per-dialog customization
// point - `animation` (on Dialog itself) customizes *what* the entrance/exit look like, not
// this stagger.
const CONTENT_ENTRANCE_DELAY_MS = 200;

// Always fadeIn/fadeOut, never customizable - only the content's animation is (see Dialog's
// own `animation` prop), matching "fading in a full screen ... background container" being a
// fixed part of the design rather than a per-dialog choice.
const OVERLAY_ANIMATION: AnimationSpec = { entrance: 'animate__fadeIn', exit: 'animate__fadeOut' };

const overlayClasses = (trigger: AnimationTrigger) =>
  mergeClassNames(
    'fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 p-4',
    resolveAnimationClasses(OVERLAY_ANIMATION, trigger),
  );

// One per record, bridging the store's `closing` flag to Radix's open/onOpenChange contract
// and to Dialog's `trigger` prop - the same pattern AlertContainer uses for Alert. Kept as its
// own component so its effect below follows normal per-item hook rules.
const DialogPortalItem = ({ record }: { readonly record: DialogRecord }) => {
  const trigger: AnimationTrigger = record.closing ? 'exit' : 'entrance';
  const effectiveAnimation = record.animation ?? DEFAULT_DIALOG_ANIMATION;

  const handleClose = () => requestDialogClose(record.id);

  // The store only ever marks a record "closing" - actually removing it (and firing the
  // caller's own onClose from dialog.show(..., { onClose })) waits here until both the overlay
  // and the content have had time to finish their exit animation.
  useEffect(() => {
    if (!record.closing) return undefined;
    const delayMs = Math.max(resolveAnimationDurationMs(effectiveAnimation), resolveAnimationDurationMs(OVERLAY_ANIMATION));
    const timer = setTimeout(() => removeDialog(record.id), delayMs);
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
        <DialogPrimitive.Overlay className={overlayClasses(trigger)}>
          <DialogPrimitive.Content
            onEscapeKeyDown={(event) => {
              if (!record.closeOnEscape) event.preventDefault();
            }}
            onInteractOutside={(event) => {
              if (!record.closeOnOverlayClick) event.preventDefault();
            }}
            className="outline-none"
          >
            <Dialog
              width={record.width}
              height={record.height}
              closeable={record.closeable}
              onClose={handleClose}
              animation={record.animation}
              trigger={trigger}
              style={trigger === 'entrance' ? { animationDelay: `${CONTENT_ENTRANCE_DELAY_MS}ms` } : undefined}
            >
              <DialogPrimitive.Title className={record.title ? 'pr-6 text-lg font-semibold text-surface-900' : 'sr-only'}>
                {record.title ?? 'Dialog'}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className={record.description ? 'text-sm text-surface-600' : 'sr-only'}>
                {record.description ?? ''}
              </DialogPrimitive.Description>

              {typeof record.content === 'function' ? record.content({ close: handleClose }) : record.content}
            </Dialog>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

// Mount once, high in the component tree (see the root App component). This is the only thing
// that needs a fixed spot - `dialog.show()`/`dialog.confirm()` can be called from anywhere
// regardless of where this renders, since they only ever touch the module-level store in
// ../../dialog/dialogStore.ts. Handles the overlay, centering, portal rendering, focus trap,
// and Escape/outside-click dismissal via Radix; multiple simultaneously-open dialogs stack
// naturally (each is its own independent Root/Overlay/Content, later ones painting on top).
export const DialogContainer = () => {
  const records = useSyncExternalStore(subscribeToDialogs, getDialogRecords, getDialogRecords);

  return (
    <>
      {records.map((record) => (
        <DialogPortalItem key={record.id} record={record} />
      ))}
    </>
  );
};
