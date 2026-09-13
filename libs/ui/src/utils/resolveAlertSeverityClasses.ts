import type { AlertSeverity } from '../tokens/alert';

// Literal per the design spec's severity matrix - unlike the ColorSpec-driven resolvers
// elsewhere in this package, severity is a small fixed enum with a fixed color per state, so
// there's no runtime-interpolation gap to safelist here: every class below is a literal
// substring Tailwind's scanner finds directly in this file.
const SEVERITY_CLASSES: Record<AlertSeverity, string> = {
  default: 'bg-surface-100 border-surface-300 text-surface-900',
  success: 'bg-green-100 border-green-500 text-green-500',
  danger: 'bg-red-100 border-red-500 text-red-500',
  warning: 'bg-yellow-100 border-yellow-500 text-yellow-500',
  info: 'bg-blue-100 border-blue-500 text-blue-500',
  notification: 'bg-surface-200 border-surface-400 text-surface-900',
};

export const resolveAlertSeverityClasses = (severity: AlertSeverity): string => SEVERITY_CLASSES[severity];
