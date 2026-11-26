import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Box, Button, ListRow, Pagination, Select, SelectItem, Text, dialog } from '@inithium/ui';
import { formatDate, formatMoney, useGetPaymentHealthQuery, useListPaymentEventsQuery } from '@inithium/api-client';
import type { PaymentEventDto, PaymentHealthDto, PaymentHealthLevel } from '@inithium/api-client';
import { canAccessCmsResource, useCmsCurrentUser } from '../../CmsCurrentUserContext';
import { DIALOG_WIDTH_WIDE, EmptyState, fullNameOf } from '../ecommerce/shared';
import { OrderAdminDetail } from '../orders/OrderAdminDetail';
import { shortOrderNumber } from '../orders/orderDisplay';
import { EVENT_STATUS_LABELS, EVENT_STATUS_LEVEL, LevelBadge, LevelIcon, eventTypeLabel, formatDateTime } from './healthDisplay';

const EVENTS_PAGE_SIZE = 15;
const ALL = 'all';
const EVENT_STATUSES = Object.keys(EVENT_STATUS_LABELS) as PaymentEventDto['status'][];

const Section = ({ title, children, action }: { readonly title: string; readonly children: ReactNode; readonly action?: ReactNode }) => (
  <Box flex={{ direction: 'col', gap: 8 }}>
    <Box flex={{ direction: 'row', justify: 'between', align: 'center', wrap: 'wrap', gap: 8 }}>
      <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-semibold">
        {title}
      </Text>
      {action}
    </Box>
    <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
      {children}
    </Box>
  </Box>
);

const FactRow = ({ level, label, value }: { readonly level: PaymentHealthLevel; readonly label: string; readonly value: string }) => (
  <ListRow leading={<LevelIcon level={level} />}>
    <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
      {label}
    </Text>
    <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="whitespace-pre-line break-words text-sm">
      {value}
    </Text>
  </ListRow>
);

const describeKey = (key: { configured: boolean; mode?: string }): string =>
  key.configured ? `Set${key.mode ? ` (${key.mode} mode)` : ''}` : 'Not set';

const SetupFacts = ({ health }: { readonly health: PaymentHealthDto }) => {
  const { provider, webhook } = health;
  const endpoints = provider.webhookEndpoints;
  const endpointsLevel: PaymentHealthLevel =
    endpoints === null ? 'warning' : endpoints.some((endpoint) => endpoint.enabled && endpoint.missingEvents.length === 0) ? 'ok' : 'critical';
  const endpointsValue =
    endpoints === null
      ? provider.webhookEndpointsError ?? 'Could not check.'
      : endpoints.length === 0
        ? `None. Stripe has no endpoint ending in ${webhook.path}.`
        : endpoints
            .map((endpoint) =>
              [endpoint.url, endpoint.enabled ? 'enabled' : 'DISABLED', endpoint.missingEvents.length > 0 ? `missing ${endpoint.missingEvents.join(', ')}` : '']
                .filter(Boolean)
                .join(' · '),
            )
            .join('\n');

  return (
    <>
      <FactRow
        level={provider.secretKey.valid ? 'ok' : 'critical'}
        label="Secret key (STRIPE_SECRET_KEY)"
        value={provider.secretKey.valid ? `Works (${provider.secretKey.mode ?? 'unknown'} mode)` : provider.secretKey.error ?? 'Does not work'}
      />
      <FactRow
        level={provider.publishableKey.configured ? 'ok' : 'critical'}
        label="Publishable key (STRIPE_PUBLISHABLE_KEY)"
        value={describeKey(provider.publishableKey)}
      />
      <FactRow
        level={provider.webhookSecretConfigured ? 'ok' : 'critical'}
        label="Webhook signing secret (STRIPE_WEBHOOK_SECRET)"
        value={provider.webhookSecretConfigured ? 'Set' : 'Not set'}
      />
      <FactRow level={endpointsLevel} label="Webhook endpoint in Stripe" value={endpointsValue} />
      <FactRow
        level={webhook.lastReceivedAt ? 'ok' : 'warning'}
        label="Last message from Stripe"
        value={webhook.lastReceivedAt ? formatDateTime(webhook.lastReceivedAt) : 'Never'}
      />
      {webhook.lastRejectedAt ? (
        <FactRow
          level="warning"
          label="Last rejected delivery (bad signature)"
          value={`${formatDateTime(webhook.lastRejectedAt)} · ${webhook.rejectedCount ?? 0} in total`}
        />
      ) : null}
    </>
  );
};

const RecentEvents = () => {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PaymentEventDto['status'] | typeof ALL>(ALL);
  useEffect(() => setPage(1), [status]);
  const { data, isLoading, refetch } = useListPaymentEventsQuery({ page, pageSize: EVENTS_PAGE_SIZE, ...(status !== ALL ? { status } : {}) });

  return (
    <Section
      title="Messages from Stripe"
      action={
        <Box flex={{ direction: 'row', align: 'end', gap: 8 }}>
          <Select label="Status" value={status} onValueChange={(next) => setStatus(next as PaymentEventDto['status'] | typeof ALL)}>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {EVENT_STATUSES.map((candidate) => (
              <SelectItem key={candidate} value={candidate}>
                {EVENT_STATUS_LABELS[candidate]}
              </SelectItem>
            ))}
          </Select>
          <Button variant={{ kind: 'ghost', color: 'surface' }} textColor={{ color: 'surface', intensity: 900 }} onClick={() => refetch()}>
            Reload
          </Button>
        </Box>
      }
    >
      {isLoading ? (
        <EmptyState message="Loading..." />
      ) : data && data.items.length > 0 ? (
        <>
          {data.items.map((event) => (
            <ListRow
              key={event.id}
              leading={<LevelIcon level={EVENT_STATUS_LEVEL[event.status]} />}
              trailing={
                <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm tabular-nums">
                  {formatDateTime(event.updatedAt)}
                </Text>
              }
            >
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
                {`${eventTypeLabel(event.type)} · ${EVENT_STATUS_LABELS[event.status]}`}
              </Text>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="break-all text-xs">
                {[
                  event.status === 'rejected' ? `${event.attempts ?? 0} rejected deliveries in total` : event.eventId,
                  event.reference,
                  event.orderId ? `order #${shortOrderNumber({ id: event.orderId })}` : undefined,
                  event.error ? `error: ${event.error}` : undefined,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </ListRow>
          ))}
          {data.totalPages > 1 ? (
            <Box padding={{ base: 8 }}>
              <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
            </Box>
          ) : null}
        </>
      ) : (
        <EmptyState message="No messages from Stripe yet." />
      )}
    </Section>
  );
};

export const PaymentHealthModule = () => {
  const currentUser = useCmsCurrentUser();
  const canManageLedger = canAccessCmsResource(currentUser, 'ledger:manage');
  const { data: health, isFetching, isError, refetch } = useGetPaymentHealthQuery();

  const openOrder = (orderId: string) => {
    dialog.show(() => <OrderAdminDetail orderId={orderId} canManageLedger={canManageLedger} />, { title: 'Order', width: DIALOG_WIDTH_WIDE });
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 24 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', wrap: 'wrap', gap: 16 }}>
        <Box flex={{ direction: 'col', gap: 4 }}>
          <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
            Payment Health
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
            {health ? `Checked ${formatDateTime(health.checkedAt)}. The payments runbook explains every item.` : 'Checking with Stripe...'}
          </Text>
        </Box>
        <Button
          variant={{ kind: 'outlined', color: 'surface', intensity: 400 }}
          textColor={{ color: 'surface', intensity: 900 }}
          disabled={isFetching}
          onClick={() => refetch()}
        >
          {isFetching ? 'Checking…' : 'Check again'}
        </Button>
      </Box>

      {isError && !health ? (
        <Text as="p" textColor={{ color: 'red', intensity: 600 }}>
          The health check itself failed to load. The API may be down; contact the developer.
        </Text>
      ) : null}

      {health ? (
        <>
          <Box flex={{ direction: 'row' }}>
            <LevelBadge level={health.status} />
          </Box>

          <Section title="What to look at">
            {health.checks.map((check) => (
              <ListRow key={check.id} leading={<LevelIcon level={check.level} />}>
                <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
                  {check.title}
                </Text>
                <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                  {check.detail}
                </Text>
              </ListRow>
            ))}
          </Section>

          <Section title="Setup">
            <SetupFacts health={health} />
          </Section>

          <Section title={`Orders waiting on payment for over an hour (${health.stuckOrders.total})`}>
            {health.stuckOrders.items.length > 0 ? (
              health.stuckOrders.items.map((order) => (
                <ListRow
                  key={order.id}
                  trailing={
                    <>
                      <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold tabular-nums">
                        {formatMoney(order.totalCents, order.currency)}
                      </Text>
                      <Button variant={{ kind: 'ghost', color: 'surface' }} textColor={{ color: 'surface', intensity: 900 }} onClick={() => openOrder(order.id)}>
                        View
                      </Button>
                    </>
                  }
                >
                  <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="truncate font-medium">
                    {`${fullNameOf(order.customer)} · ${order.customer.email}`}
                  </Text>
                  <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="break-all text-sm">
                    {[`#${shortOrderNumber(order)}`, formatDateTime(order.createdAt), order.paymentId ?? 'no payment started', order.itemNames.join(', ')].join(' · ')}
                  </Text>
                </ListRow>
              ))
            ) : (
              <EmptyState message="None." />
            )}
          </Section>

          <Section title={`Past-due subscriptions (${health.pastDueSubscriptions.total})`}>
            {health.pastDueSubscriptions.items.length > 0 ? (
              health.pastDueSubscriptions.items.map((subscription) => (
                <ListRow
                  key={subscription.id}
                  trailing={
                    <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold tabular-nums">
                      {formatMoney(subscription.monthlyCents, subscription.currency)}
                    </Text>
                  }
                >
                  <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="truncate font-medium">
                    {`${fullNameOf(subscription.customer)} · ${subscription.customer.email}`}
                  </Text>
                  <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="break-all text-sm">
                    {[
                      subscription.itemNames.join(', '),
                      subscription.currentPeriodEnd ? `period ends ${formatDate(subscription.currentPeriodEnd)}` : undefined,
                      subscription.providerSubscriptionId,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </ListRow>
              ))
            ) : (
              <EmptyState message="None." />
            )}
          </Section>
        </>
      ) : null}

      <RecentEvents />
    </Box>
  );
};
