import { Box, Icon, Text } from '@inithium/ui';
import type { ColorSpec, IconName } from '@inithium/ui';
import type { PaymentEventDto, PaymentHealthLevel } from '@inithium/api-client';

// Shared by the Payment Health module and its dashboard widget. Each level pairs a color with its
// own icon, so the state reads without relying on color alone.

interface LevelStyle {
  readonly icon: IconName;
  readonly color: ColorSpec;
  readonly label: string;
}

export const LEVEL_STYLES: Record<PaymentHealthLevel, LevelStyle> = {
  ok: { icon: 'CheckCircle', color: { color: 'secondary', intensity: 500 }, label: 'Working' },
  warning: { icon: 'WarningCircle', color: { color: 'accent', intensity: 500 }, label: 'Needs attention' },
  critical: { icon: 'XCircle', color: { color: 'red', intensity: 600 }, label: 'Payments are broken' },
};

export const EVENT_STATUS_LABELS: Record<PaymentEventDto['status'], string> = {
  processing: 'Processing',
  processed: 'Processed',
  failed: 'Failed',
  rejected: 'Rejected (bad signature)',
};

export const EVENT_STATUS_LEVEL: Record<PaymentEventDto['status'], PaymentHealthLevel> = {
  processing: 'warning',
  processed: 'ok',
  failed: 'warning',
  rejected: 'critical',
};

// Stripe event types in plain words for the owner; unknown types fall back to the raw name.
const EVENT_TYPE_LABELS: Record<string, string> = {
  'payment_intent.succeeded': 'Payment succeeded',
  'payment_intent.payment_failed': 'Payment failed',
  'invoice.paid': 'Invoice paid',
  'invoice.payment_failed': 'Renewal payment failed',
  'customer.subscription.updated': 'Subscription updated',
  'customer.subscription.deleted': 'Subscription ended',
  invalid_signature: 'Delivery with a bad signature',
};

export const eventTypeLabel = (type: string): string => EVENT_TYPE_LABELS[type] ?? type;

export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const LevelIcon = ({ level, size = 20 }: { readonly level: PaymentHealthLevel; readonly size?: number }) => (
  <span title={LEVEL_STYLES[level].label} className="inline-flex shrink-0">
    <Icon name={LEVEL_STYLES[level].icon} size={size} weight="fill" textColor={LEVEL_STYLES[level].color} />
  </span>
);

export const LevelBadge = ({ level }: { readonly level: PaymentHealthLevel }) => (
  <Box
    flex={{ direction: 'row', align: 'center', gap: 8 }}
    borderColor={{ color: 'surface', intensity: 200 }}
    padding={{ base: 8 }}
    className="rounded border"
  >
    <LevelIcon level={level} size={24} />
    <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
      {LEVEL_STYLES[level].label}
    </Text>
  </Box>
);
