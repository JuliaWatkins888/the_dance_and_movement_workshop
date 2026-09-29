import { Pill } from '@inithium/ui';
import type { OrderDto } from '@inithium/api-client';

export const shortOrderNumber = (order: { id: string }): string => order.id.slice(-8).toUpperCase();

const KIND_LABELS: Record<OrderDto['kind'], string> = {
  checkout: 'Online',
  renewal: 'Renewal',
  manual: 'Staff-recorded',
};

export const orderKindLabel = (kind: OrderDto['kind']): string => KIND_LABELS[kind];

export const ORDER_STATUS_LABELS: Record<OrderDto['status'], string> = {
  pending: 'Pending payment',
  paid: 'Paid',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  failed: 'Payment failed',
};

// Paid is the "act on this" state, so it gets the primary brand pair; everything else stays on the
// surface scale so it inverts correctly in dark mode.
const STATUS_CLASSES: Record<OrderDto['status'], string> = {
  pending: 'bg-surface-300 text-surface-900',
  paid: 'bg-primary-500 text-primary-foreground-500',
  fulfilled: 'bg-surface-800 text-surface-100',
  cancelled: 'bg-surface-300 text-surface-700',
  refunded: 'bg-surface-300 text-surface-700',
  failed: 'bg-surface-300 text-surface-700',
};

export const OrderStatusPill = ({ status }: { readonly status: OrderDto['status'] }) => (
  <Pill color={{ color: 'surface', intensity: 300 }} className={STATUS_CLASSES[status]}>
    {ORDER_STATUS_LABELS[status]}
  </Pill>
);
