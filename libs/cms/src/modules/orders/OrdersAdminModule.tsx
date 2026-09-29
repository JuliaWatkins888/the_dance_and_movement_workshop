import { useEffect, useState } from 'react';
import { alert, Box, Button, Icon, Input, ListRow, Pagination, Select, SelectItem, Text, dialog } from '@inithium/ui';
import { downloadOrdersCsv, formatDate, formatMoney, useListOrdersAdminQuery } from '@inithium/api-client';
import type { AdminOrderDto, OrderDto } from '@inithium/api-client';
import { canAccessCmsResource, useCmsCurrentUser } from '../../CmsCurrentUserContext';
import { DIALOG_WIDTH_WIDE, EmptyState, fullNameOf } from '../ecommerce/shared';
import { CreateOrderDialog } from './CreateOrderDialog';
import { OrderAdminDetail } from './OrderAdminDetail';
import { ORDER_STATUS_LABELS, OrderStatusPill, orderKindLabel, shortOrderNumber } from './orderDisplay';

const PAGE_SIZE = 15;
const ALL = 'all';
const ALERT_POSITION = 'bottom-right' as const;
const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderDto['status'][];
const ORDER_KINDS: OrderDto['kind'][] = ['checkout', 'renewal', 'manual'];

// <input type="date"> gives a local calendar day; the API filters by instant.
const startOfLocalDay = (value: string): string | undefined => (value ? new Date(`${value}T00:00:00`).toISOString() : undefined);
const startOfNextLocalDay = (value: string): string | undefined => {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
};

const summarizeItems = (order: AdminOrderDto): string => {
  const [first, ...rest] = order.lines;
  if (!first) return 'No items';
  return rest.length > 0 ? `${first.name} + ${rest.length} more` : first.name;
};

export const OrdersAdminModule = () => {
  const currentUser = useCmsCurrentUser();
  const canRecordSales = canAccessCmsResource(currentUser, 'ecommerce:record-sales');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderDto['status'] | typeof ALL>(ALL);
  const [kind, setKind] = useState<OrderDto['kind'] | typeof ALL>(ALL);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  useEffect(() => setPage(1), [status, kind, fromDate, toDate]);

  const from = startOfLocalDay(fromDate);
  const to = startOfNextLocalDay(toDate);
  const { data, isLoading } = useListOrdersAdminQuery({
    page,
    pageSize: PAGE_SIZE,
    ...(status !== ALL ? { status } : {}),
    ...(kind !== ALL ? { kind } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });

  const openOrder = (orderId: string) => {
    dialog.show(() => <OrderAdminDetail orderId={orderId} />, { title: 'Order', width: DIALOG_WIDTH_WIDE });
  };

  const openCreate = () => {
    const id = dialog.show(
      () => (
        <CreateOrderDialog
          onCancel={() => dialog.close(id)}
          onCreated={(order) => {
            dialog.close(id);
            alert.success(`Order #${shortOrderNumber(order)} recorded.`, { position: ALERT_POSITION });
            openOrder(order.id);
          }}
        />
      ),
      { title: 'Create Order', width: DIALOG_WIDTH_WIDE },
    );
  };

  const exportCsv = async () => {
    setIsExporting(true);
    try {
      await downloadOrdersCsv({ ...(from ? { from } : {}), ...(to ? { to } : {}), ...(status !== ALL ? { status } : {}) });
    } catch {
      alert.danger('The export failed. Please try again.', { position: ALERT_POSITION });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', wrap: 'wrap', gap: 16 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Orders
        </Text>
        <Box flex={{ direction: 'row', gap: 8 }}>
          <Button
            variant={{ kind: 'outlined', color: 'surface', intensity: 400 }}
            textColor={{ color: 'surface', intensity: 900 }}
            disabled={isExporting}
            onClick={exportCsv}
          >
            {isExporting ? 'Exporting…' : 'Export CSV'}
          </Button>
          {canRecordSales ? (
            <Button variant={{ kind: 'filled', color: 'primary' }} onClick={openCreate}>
              Create Order
            </Button>
          ) : null}
        </Box>
      </Box>

      <Box className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select label="Status" value={status} onValueChange={(next) => setStatus(next as OrderDto['status'] | typeof ALL)}>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {ORDER_STATUSES.map((candidate) => (
            <SelectItem key={candidate} value={candidate}>
              {ORDER_STATUS_LABELS[candidate]}
            </SelectItem>
          ))}
        </Select>
        <Select label="Type" value={kind} onValueChange={(next) => setKind(next as OrderDto['kind'] | typeof ALL)}>
          <SelectItem value={ALL}>All types</SelectItem>
          {ORDER_KINDS.map((candidate) => (
            <SelectItem key={candidate} value={candidate}>
              {orderKindLabel(candidate)}
            </SelectItem>
          ))}
        </Select>
        <Input label="From" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        <Input label="To" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
      </Box>

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <EmptyState message="Loading orders..." />
        ) : data && data.items.length > 0 ? (
          data.items.map((order) => (
            <ListRow
              key={order.id}
              trailing={
                <Box flex={{ direction: 'row', align: 'center', gap: 12 }}>
                  <OrderStatusPill status={order.status} />
                  <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="w-24 text-right font-semibold tabular-nums">
                    {formatMoney(order.totals.totalCents, order.currency)}
                  </Text>
                  <Button variant={{ kind: 'ghost', color: 'surface' }} textColor={{ color: 'surface', intensity: 900 }} onClick={() => openOrder(order.id)}>
                    View
                  </Button>
                </Box>
              }
            >
              <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
                {order.fulfillmentErrors.length > 0 ? (
                  <span title="Needs attention">
                    <Icon name="Warning" size={16} textColor={{ color: 'surface', intensity: 900 }} />
                  </span>
                ) : null}
                <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="truncate font-medium">
                  {fullNameOf(order.customer)}
                </Text>
              </Box>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="truncate text-sm">
                {`#${shortOrderNumber(order)} · ${formatDate(order.createdAt)} · ${orderKindLabel(order.kind)} · ${summarizeItems(order)}`}
              </Text>
            </ListRow>
          ))
        ) : (
          <EmptyState message="No orders match these filters." />
        )}
      </Box>

      {data && data.totalPages > 1 ? <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};
