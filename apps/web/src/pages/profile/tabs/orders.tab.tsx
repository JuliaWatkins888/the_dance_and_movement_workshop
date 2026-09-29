import { useState } from 'react';
import { Box, dialog, Divider, Loader, Pagination, Text } from '@inithium/ui';
import { formatDate, formatMoney, useListMyOrdersQuery } from '@inithium/api-client';
import type { OrderDto } from '@inithium/api-client';
import { OrderDetails, shortOrderNumber } from '../../ecommerce/OrderDetails';
import { OrderStatusPill } from '../../ecommerce/OrderStatusPill';
import type { ProfileTabDescriptor, ProfileTabProps } from './registry';

const PAGE_SIZE = 10;

const summarizeItems = (order: OrderDto): string => {
  const [first, ...rest] = order.lines;
  if (!first) return 'No items';
  return rest.length > 0 ? `${first.name} and ${rest.length} more` : first.name;
};

const openOrder = (order: OrderDto) =>
  dialog.show(({ close }) => <OrderDetails order={order} onNavigate={close} />, {
    title: `Order #${shortOrderNumber(order)}`,
    width: 'min(48rem, 92vw)',
  });

const OrderRow = ({ order }: { readonly order: OrderDto }) => (
  <button
    type="button"
    onClick={() => openOrder(order)}
    className="flex w-full items-center gap-4 rounded-md px-3 py-4 text-left transition-colors hover:bg-surface-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
  >
    <Box flex={{ direction: 'col', gap: 2 }} className="min-w-0 flex-1">
      <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="truncate font-medium">
        {summarizeItems(order)}
      </Text>
      <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
        {`#${shortOrderNumber(order)} · ${formatDate(order.createdAt)}${order.kind === 'renewal' ? ' · Renewal' : ''}`}
      </Text>
    </Box>
    <OrderStatusPill status={order.status} />
    <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="w-24 text-right font-semibold tabular-nums">
      {formatMoney(order.totals.totalCents, order.currency)}
    </Text>
  </button>
);

// Purchase history for the signed-in owner only - checkout orders and subscription renewals alike.
const OrdersTab = ({ profile }: ProfileTabProps) => {
  const [page, setPage] = useState(1);
  // visibility 'owned' guarantees profile.id is the viewer's own id; the endpoint always answers
  // for the bearer token, and the id keys the per-user cache.
  const { data, isLoading } = useListMyOrdersQuery({ userId: profile.id, page, pageSize: PAGE_SIZE });

  if (isLoading) {
    return (
      <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      </Box>
    );
  }

  const orders = data?.items ?? [];
  if (orders.length === 0) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }} padding={{ base: 24 }} className="text-center">
        You haven’t placed any orders yet.
      </Text>
    );
  }

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box>
        {orders.map((order, index) => (
          <Box key={order.id}>
            {index > 0 ? <Divider color={{ color: 'surface', intensity: 300 }} /> : null}
            <OrderRow order={order} />
          </Box>
        ))}
      </Box>
      {data && data.totalPages > 1 ? <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};

const ordersTab: ProfileTabDescriptor = {
  id: 'orders',
  label: 'Orders',
  order: 15,
  visibility: 'owned',
  Component: OrdersTab,
};

export default ordersTab;
