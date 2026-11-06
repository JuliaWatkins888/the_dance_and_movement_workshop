import { useEffect, useState } from 'react';
import { alert, Box, Button, ListRow, Pagination, Pill, Select, SelectItem, Text, dialog } from '@inithium/ui';
import {
  formatBillingInterval,
  formatDate,
  formatMoney,
  readApiError,
  useCancelSubscriptionAdminMutation,
  useCancelSubscriptionLineAdminMutation,
  useListSubscriptionsAdminQuery,
} from '@inithium/api-client';
import type { AdminSubscriptionDto } from '@inithium/api-client';
import type { BillingSubscriptionStatus } from '@inithium/db';
import { EmptyState, fullNameOf } from '../ecommerce/shared';

const PAGE_SIZE = 10;
const ALERT_POSITION = 'bottom-right' as const;
const ALL = 'all';

const STATUS_LABELS: Record<BillingSubscriptionStatus, string> = {
  active: 'Active',
  past_due: 'Past due',
  canceled: 'Canceled',
  ended: 'Ended',
};

const STATUS_CLASSES: Record<BillingSubscriptionStatus, string> = {
  active: 'bg-primary-500 text-primary-foreground-500',
  past_due: 'bg-surface-800 text-surface-100',
  canceled: 'bg-surface-300 text-surface-700',
  ended: 'bg-surface-300 text-surface-700',
};

const isLive = (subscription: AdminSubscriptionDto): boolean => subscription.status === 'active' || subscription.status === 'past_due';

const liveLines = (subscription: AdminSubscriptionDto) => subscription.lines.filter((line) => line.status === 'active');

const lineLabel = (line: AdminSubscriptionDto['lines'][number]): string => (line.attendeeName ? `${line.name} (${line.attendeeName})` : line.name);

const describe = (subscription: AdminSubscriptionDto): string => {
  const activeLines = liveLines(subscription);
  const lines = (activeLines.length > 0 ? activeLines : subscription.lines).map((line) => `${line.quantity} × ${lineLabel(line)}`).join(', ');
  const perPeriod = activeLines.reduce((sum, line) => sum + line.unitAmountCents * line.quantity, 0);
  const cadence = `${formatMoney(perPeriod, subscription.currency)} / ${formatBillingInterval(subscription.interval, subscription.intervalCount)}`;
  const next = isLive(subscription) && subscription.currentPeriodEnd ? `next charge ${formatDate(subscription.currentPeriodEnd)}` : '';
  const ends = subscription.endsAt ? `ends ${formatDate(subscription.endsAt)}` : '';
  const stopped = subscription.canceledAt ? `stopped ${formatDate(subscription.canceledAt)}` : '';
  return [lines, isLive(subscription) ? cadence : '', next, ends, stopped].filter(Boolean).join(' · ');
};

export const SubscriptionsAdminModule = () => {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<BillingSubscriptionStatus | typeof ALL>('active');
  useEffect(() => setPage(1), [status]);

  const { data, isLoading } = useListSubscriptionsAdminQuery({ page, pageSize: PAGE_SIZE, ...(status !== ALL ? { status } : {}) });
  const [cancelSubscription, { isLoading: isCanceling }] = useCancelSubscriptionAdminMutation();
  const [cancelLine, { isLoading: isCancelingLine }] = useCancelSubscriptionLineAdminMutation();

  const handleCancelLine = async (subscription: AdminSubscriptionDto, lineId: string, lineName: string) => {
    const confirmed = await dialog.confirm({
      title: `Cancel "${lineName}"?`,
      description:
        'Billing for this item stops immediately, with no proration or refund - the period already paid for is kept. Everything else on this subscription keeps billing. This cannot be undone.',
      confirmLabel: 'Cancel item',
      cancelLabel: 'Keep it',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    try {
      await cancelLine({ subscriptionId: subscription.id, lineId }).unwrap();
      alert.success(`"${lineName}" canceled.`, { position: ALERT_POSITION });
    } catch (error) {
      alert.danger(readApiError(error, 'Could not cancel this item.').message, { position: ALERT_POSITION });
    }
  };

  const handleCancel = async (subscription: AdminSubscriptionDto) => {
    const confirmed = await dialog.confirm({
      title: `Cancel ${fullNameOf(subscription.customer)}'s subscription?`,
      description:
        'Billing stops immediately, with no proration or refund - the period already paid for is kept. Any item that grants access (like a class) is notified so it can end on its own schedule. This cannot be undone.',
      confirmLabel: 'Cancel subscription',
      cancelLabel: 'Keep it',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    try {
      await cancelSubscription(subscription.id).unwrap();
      alert.success('Subscription canceled.', { position: ALERT_POSITION });
    } catch (error) {
      alert.danger(readApiError(error, 'Could not cancel this subscription.').message, { position: ALERT_POSITION });
    }
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
        <Box flex={{ direction: 'col', gap: 4 }}>
          <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
            Subscriptions
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
            Recurring purchases billed automatically by your payment provider.
          </Text>
        </Box>
        <Select value={status} onValueChange={(next) => setStatus(next as BillingSubscriptionStatus | typeof ALL)} className="w-44">
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="past_due">Past due</SelectItem>
          <SelectItem value="canceled">Canceled</SelectItem>
          <SelectItem value="ended">Ended</SelectItem>
          <SelectItem value={ALL}>All</SelectItem>
        </Select>
      </Box>

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <EmptyState message="Loading subscriptions..." />
        ) : data && data.items.length > 0 ? (
          data.items.map((subscription) => (
            <ListRow
              key={subscription.id}
              trailing={
                isLive(subscription) ? (
                  <Button
                    variant={{ kind: 'outlined', color: 'surface', intensity: 400 }}
                    textColor={{ color: 'surface', intensity: 900 }}
                    disabled={isCanceling}
                    onClick={() => handleCancel(subscription)}
                  >
                    Cancel
                  </Button>
                ) : undefined
              }
            >
              <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
                <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
                  {fullNameOf(subscription.customer)}
                </Text>
                <Pill color={{ color: 'surface', intensity: 300 }} className={STATUS_CLASSES[subscription.status]}>
                  {STATUS_LABELS[subscription.status]}
                </Pill>
              </Box>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                {describe(subscription)}
              </Text>
              {isLive(subscription) && liveLines(subscription).length > 1
                ? liveLines(subscription).map((line) => (
                    <Box key={line.id} flex={{ direction: 'row', align: 'center', gap: 8 }}>
                      <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
                        {lineLabel(line)}
                      </Text>
                      <Button
                        variant={{ kind: 'outlined', color: 'surface', intensity: 400 }}
                        textColor={{ color: 'surface', intensity: 900 }}
                        disabled={isCancelingLine}
                        onClick={() => handleCancelLine(subscription, line.id, lineLabel(line))}
                      >
                        Cancel item
                      </Button>
                    </Box>
                  ))
                : null}
            </ListRow>
          ))
        ) : (
          <EmptyState message="No subscriptions to show." />
        )}
      </Box>

      {data && data.totalPages > 1 ? <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};
