import { useEffect, useSyncExternalStore } from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveAlertAnimation, resolveExitDurationMs } from '../../utils/resolveAlertAnimation';
import { subscribeToAlerts, getAlertRecords, requestAlertClose, removeAlert, type AlertRecord } from '../../alert/alertStore';
import { ALERT_POSITIONS, type AlertPosition } from '../../tokens/alert';
import { Alert } from '../Alert/Alert';

const POSITION_VIEWPORT_CLASSES: Record<AlertPosition, string> = {
  'top-right': 'top-0 right-0 items-end',
  'top-left': 'top-0 left-0 items-start',
  'bottom-right': 'bottom-0 right-0 flex-col-reverse items-end',
  'bottom-left': 'bottom-0 left-0 flex-col-reverse items-start',
};

const POSITION_LABELS: Record<AlertPosition, string> = {
  'top-right': 'Notifications (top right)',
  'top-left': 'Notifications (top left)',
  'bottom-right': 'Notifications (bottom right)',
  'bottom-left': 'Notifications (bottom left)',
};

// One per record, bridging the store's `closing` flag to Radix's open/onOpenChange contract
// and to Alert's `trigger` prop. Kept as its own component (not inlined in AlertContainer's
// .map()) purely so its effect below follows normal per-item hook rules.
const AlertToast = ({ record }: { readonly record: AlertRecord }) => {
  const effectiveAnimation = resolveAlertAnimation(record.position, record.animation);

  // The store only ever marks a record "closing" - actually removing it (and firing the
  // caller's own onClose from alert.show(..., { onClose })) waits here until the exit
  // animation has had time to play. Whether `closing` became true because of Radix's own
  // duration/swipe timer, the close button inside Alert, or a direct `alert.dismiss(id)`
  // call, this is the one place that finally tears the record down.
  useEffect(() => {
    if (!record.closing) return undefined;
    const timer = setTimeout(() => removeAlert(record.id), resolveExitDurationMs(effectiveAnimation));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.closing, record.id]);

  return (
    <ToastPrimitive.Root
      open={!record.closing}
      onOpenChange={(open) => {
        if (!open) requestAlertClose(record.id);
      }}
      duration={record.duration > 0 ? record.duration : Infinity}
      className="list-none"
    >
      <Alert
        message={record.message}
        severity={record.severity}
        position={record.position}
        closeable={record.closeable}
        duration={0}
        onClose={() => requestAlertClose(record.id)}
        animation={record.animation}
        trigger={record.closing ? 'exit' : 'entrance'}
      />
    </ToastPrimitive.Root>
  );
};

// Mount once, high in the component tree (see the root App component). This is the only thing
// that needs a fixed spot - `alert.show()` and its severity shorthands can be called from
// anywhere regardless of where this renders, since they only ever touch the module-level store
// in ../../alert/alertStore.ts. Handles fixed positioning (one Radix Viewport per corner
// actually in use), stacking, and - via Radix's Toast.Root - portal rendering, focus
// management, swipe-to-dismiss, and pausing the duration timer on hover/focus.
export const AlertContainer = () => {
  const records = useSyncExternalStore(subscribeToAlerts, getAlertRecords, getAlertRecords);
  const positionsInUse = ALERT_POSITIONS.filter((position) => records.some((record) => record.position === position));

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {positionsInUse.map((position) => (
        <ToastPrimitive.Viewport
          key={position}
          label={POSITION_LABELS[position]}
          className={mergeClassNames(
            'fixed z-[100] flex max-h-screen w-full max-w-sm list-none flex-col gap-2 p-4 outline-none',
            POSITION_VIEWPORT_CLASSES[position],
          )}
        >
          {records
            .filter((record) => record.position === position)
            .map((record) => (
              <AlertToast key={record.id} record={record} />
            ))}
        </ToastPrimitive.Viewport>
      ))}
    </ToastPrimitive.Provider>
  );
};
