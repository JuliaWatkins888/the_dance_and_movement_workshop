import type { ReactNode } from 'react';
import type { AnimationSpec } from '../tokens/animation';
import type { AlertPosition, AlertSeverity } from '../tokens/alert';

export interface AlertRecord {
  readonly id: string;
  readonly message: ReactNode;
  readonly severity: AlertSeverity;
  readonly position: AlertPosition;
  readonly closeable: boolean;
  readonly duration: number;
  readonly animation?: AnimationSpec;
  readonly onClose?: () => void;
  readonly closing: boolean;
}

export interface ShowAlertOptions {
  readonly severity?: AlertSeverity;
  readonly position?: AlertPosition;
  readonly closeable?: boolean;
  readonly duration?: number;
  readonly animation?: AnimationSpec;
  readonly onClose?: () => void;
}

type Listener = () => void;

// Module-level pub/sub rather than React Context: any code - a component, a future plugin, a
// non-React module like an API client interceptor - can call `alert.show(...)` (see alert.ts)
// without needing to sit inside a Provider anywhere in the tree. AlertContainer is the only
// piece that needs a fixed spot (mounted once, anywhere in the app) for alerts to actually
// render; dispatching one never depends on where that mount point is.
let records: AlertRecord[] = [];
const listeners = new Set<Listener>();
let nextId = 0;

const emit = () => listeners.forEach((listener) => listener());

export const subscribeToAlerts = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getAlertRecords = (): AlertRecord[] => records;

export const showAlert = (message: ReactNode, options: ShowAlertOptions = {}): string => {
  const id = `alert-${Date.now()}-${nextId++}`;
  const {
    severity = 'default',
    position = 'top-right',
    closeable = true,
    duration = 5000,
    animation,
    onClose,
  } = options;

  records = [
    ...records,
    { id, message, severity, position, closeable, duration, animation, onClose, closing: false },
  ];
  emit();
  return id;
};

// Marks a record as closing (so AlertContainer switches its rendered Alert to `trigger="exit"`)
// without removing it yet - actual removal happens once the exit animation has had time to
// play (AlertContainer times that via resolveExitDurationMs). Every dismissal path - the close
// button, a duration timeout, or a direct `alert.dismiss(id)` call - funnels through this one
// function, so all three get the same graceful exit regardless of what triggered them.
export const requestAlertClose = (id: string): void => {
  const record = records.find((r) => r.id === id);
  if (!record || record.closing) return;

  records = records.map((r) => (r.id === id ? { ...r, closing: true } : r));
  emit();
};

export const removeAlert = (id: string): void => {
  const record = records.find((r) => r.id === id);
  if (!record) return;

  records = records.filter((r) => r.id !== id);
  emit();
  record.onClose?.();
};

export const dismissAllAlerts = (): void => {
  records.forEach((record) => requestAlertClose(record.id));
};
