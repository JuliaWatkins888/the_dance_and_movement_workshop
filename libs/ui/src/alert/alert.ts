import type { ReactNode } from 'react';
import { showAlert, requestAlertClose, dismissAllAlerts, type ShowAlertOptions } from './alertStore';

export type AlertOptions = Omit<ShowAlertOptions, 'severity'>;

// The global dispatch API: `alert.show(message, options)` plus a shorthand per severity.
// Callable from anywhere - see alertStore.ts for why this is a plain module-level object
// rather than something obtained from a hook/Context.
export const alert = {
  show: (message: ReactNode, options?: ShowAlertOptions) => showAlert(message, options),
  success: (message: ReactNode, options?: AlertOptions) => showAlert(message, { ...options, severity: 'success' }),
  danger: (message: ReactNode, options?: AlertOptions) => showAlert(message, { ...options, severity: 'danger' }),
  warning: (message: ReactNode, options?: AlertOptions) => showAlert(message, { ...options, severity: 'warning' }),
  info: (message: ReactNode, options?: AlertOptions) => showAlert(message, { ...options, severity: 'info' }),
  notification: (message: ReactNode, options?: AlertOptions) => showAlert(message, { ...options, severity: 'notification' }),
  dismiss: requestAlertClose,
  dismissAll: dismissAllAlerts,
};
