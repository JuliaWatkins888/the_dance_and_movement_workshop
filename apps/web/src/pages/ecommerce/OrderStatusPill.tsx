import { Pill } from '@inithium/ui';
import type { OrderDto } from '@inithium/api-client';

const LABELS: Record<OrderDto['status'], string> = {
  pending: 'Processing',
  paid: 'Paid',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  failed: 'Payment failed',
};

// Completed states use the primary brand pair; everything else stays neutral on the surface scale
// (a status isn't brand identity, and surface tokens invert correctly in dark mode).
const CLASSES: Record<OrderDto['status'], string> = {
  pending: 'bg-surface-300 text-surface-900',
  paid: 'bg-primary-500 text-primary-foreground-500',
  fulfilled: 'bg-primary-500 text-primary-foreground-500',
  cancelled: 'bg-surface-300 text-surface-800',
  refunded: 'bg-surface-300 text-surface-800',
  failed: 'bg-surface-800 text-surface-100',
};

export const OrderStatusPill = ({ status }: { readonly status: OrderDto['status'] }) => (
  <Pill color={{ color: 'surface', intensity: 300 }} className={CLASSES[status]}>
    {LABELS[status]}
  </Pill>
);
