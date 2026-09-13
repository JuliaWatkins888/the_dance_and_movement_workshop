export const ALERT_SEVERITIES = ['default', 'success', 'danger', 'warning', 'info', 'notification'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_POSITIONS = ['top-right', 'top-left', 'bottom-right', 'bottom-left'] as const;
export type AlertPosition = (typeof ALERT_POSITIONS)[number];
