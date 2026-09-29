import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { alert, Box, Button, Divider, Icon, Input, Loader, Pill, Text, Textarea } from '@inithium/ui';
import {
  formatMoney,
  readApiError,
  useGetOrderAdminQuery,
  useSetOrderStatusAdminMutation,
  useUpdateOrderAdminMutation,
} from '@inithium/api-client';
import type { AdminOrderDto, AdminOrderStatus, PostalAddressInput } from '@inithium/api-client';
import { fullNameOf } from '../ecommerce/shared';
import { OrderStatusPill, orderKindLabel, shortOrderNumber } from './orderDisplay';

const ALERT_POSITION = 'bottom-right' as const;

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// Which recorded outcomes an order can move to from its current status (mirrors the API's rules).
const STATUS_ACTIONS: { status: AdminOrderStatus; label: string; from: AdminOrderDto['status'][] }[] = [
  { status: 'fulfilled', label: 'Mark fulfilled', from: ['paid'] },
  { status: 'cancelled', label: 'Cancel order', from: ['paid', 'fulfilled'] },
  { status: 'refunded', label: 'Mark refunded', from: ['paid', 'fulfilled', 'cancelled'] },
];

const Section = ({ title, children }: { readonly title: string; readonly children: ReactNode }) => (
  <Box flex={{ direction: 'col', gap: 8 }}>
    <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="text-sm font-semibold uppercase tracking-wide">
      {title}
    </Text>
    {children}
  </Box>
);

const Muted = ({ children }: { readonly children: ReactNode }) => (
  <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
    {children}
  </Text>
);

const AddressLines = ({ address }: { readonly address: PostalAddressInput }) => (
  <Box flex={{ direction: 'col' }}>
    {[address.name, address.line1, address.line2, [address.city, address.state, address.postalCode].filter(Boolean).join(', '), address.country]
      .filter(Boolean)
      .map((line) => (
        <Muted key={line}>{line}</Muted>
      ))}
  </Box>
);

const TotalRow = ({ label, value, strong }: { readonly label: string; readonly value: string; readonly strong?: boolean }) => (
  <Box flex={{ direction: 'row', justify: 'between', gap: 16 }}>
    <Text as="span" textColor={{ color: 'surface', intensity: strong ? 950 : 700 }} className={strong ? 'font-semibold' : 'text-sm'}>
      {label}
    </Text>
    <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className={`tabular-nums ${strong ? 'font-bold' : 'text-sm'}`}>
      {value}
    </Text>
  </Box>
);

const StatusActions = ({ order }: { readonly order: AdminOrderDto }) => {
  const [setStatus, { isLoading }] = useSetOrderStatusAdminMutation();
  const [pending, setPending] = useState<AdminOrderStatus | null>(null);
  const [note, setNote] = useState('');
  const available = STATUS_ACTIONS.filter((action) => action.from.includes(order.status));
  if (available.length === 0) return null;

  const confirm = async () => {
    if (!pending) return;
    try {
      await setStatus({ id: order.id, status: pending, ...(note.trim() ? { note: note.trim() } : {}) }).unwrap();
      setPending(null);
      setNote('');
    } catch (error) {
      alert.danger(readApiError(error, 'Could not update the order status.').message, { position: ALERT_POSITION });
    }
  };

  return (
    <Section title="Status">
      <Box flex={{ direction: 'row', wrap: 'wrap', gap: 8 }}>
        {available.map((action) => (
          <Button
            key={action.status}
            variant={pending === action.status ? { kind: 'filled', color: 'primary' } : { kind: 'outlined', color: 'surface', intensity: 400 }}
            textColor={pending === action.status ? { color: 'primary-foreground', intensity: 500 } : { color: 'surface', intensity: 900 }}
            onClick={() => setPending(pending === action.status ? null : action.status)}
          >
            {action.label}
          </Button>
        ))}
      </Box>
      {pending ? (
        <Box flex={{ direction: 'col', gap: 8 }}>
          <Input label="Note (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
          {pending === 'refunded' || pending === 'cancelled' ? (
            <Muted>This only records the outcome - issue any refund in your payment provider (e.g. the Stripe dashboard).</Muted>
          ) : null}
          <Box flex={{ direction: 'row', gap: 8 }}>
            <Button variant={{ kind: 'filled', color: 'primary' }} disabled={isLoading} onClick={confirm}>
              {isLoading ? 'Saving…' : 'Confirm'}
            </Button>
            <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={() => setPending(null)}>
              Never mind
            </Button>
          </Box>
        </Box>
      ) : null}
    </Section>
  );
};

const Bookkeeping = ({ order }: { readonly order: AdminOrderDto }) => {
  const [updateOrder, { isLoading }] = useUpdateOrderAdminMutation();
  const [internalNotes, setInternalNotes] = useState(order.internalNotes ?? '');
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? '');
  useEffect(() => {
    setInternalNotes(order.internalNotes ?? '');
    setTrackingNumber(order.trackingNumber ?? '');
  }, [order.internalNotes, order.trackingNumber]);
  const isDirty = internalNotes !== (order.internalNotes ?? '') || trackingNumber !== (order.trackingNumber ?? '');
  const ships = Boolean(order.shipping || order.shippingAddress);

  const save = async () => {
    try {
      await updateOrder({ id: order.id, internalNotes, trackingNumber }).unwrap();
      alert.success('Order updated.', { position: ALERT_POSITION });
    } catch (error) {
      alert.danger(readApiError(error, 'Could not save.').message, { position: ALERT_POSITION });
    }
  };

  return (
    <Section title="Staff notes">
      {ships ? <Input label="Tracking number" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} /> : null}
      <Textarea label="Internal notes" helperText="Only visible to staff." rows={3} value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} />
      <Box>
        <Button variant={{ kind: 'outlined', color: 'primary' }} disabled={!isDirty || isLoading} onClick={save}>
          {isLoading ? 'Saving…' : 'Save notes'}
        </Button>
      </Box>
    </Section>
  );
};

export const OrderAdminDetail = ({ orderId }: { readonly orderId: string }) => {
  const { data: order, isLoading, isError } = useGetOrderAdminQuery(orderId);

  if (isLoading) {
    return (
      <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      </Box>
    );
  }
  if (isError || !order) return <Muted>This order could not be loaded.</Muted>;

  const { currency, totals } = order;
  const paymentReference = order.payment.paymentId ?? order.payment.invoiceId;

  return (
    <Box flex={{ direction: 'col', gap: 20 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'start', wrap: 'wrap', gap: 12 }}>
        <Box flex={{ direction: 'col', gap: 2 }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-semibold">
            {`#${shortOrderNumber(order)} · ${orderKindLabel(order.kind)}`}
          </Text>
          <Muted>{`Placed ${formatDateTime(order.createdAt)}${order.paidAt ? ` · Paid ${formatDateTime(order.paidAt)}` : ''}`}</Muted>
        </Box>
        <OrderStatusPill status={order.status} />
      </Box>

      {order.fulfillmentErrors.length > 0 ? (
        <Box bgColor={{ color: 'surface', intensity: 200 }} borderColor={{ color: 'surface', intensity: 400 }} padding={{ base: 12 }} className="rounded border">
          <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
            <Icon name="Warning" size={18} textColor={{ color: 'surface', intensity: 900 }} />
            <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm font-semibold">
              Needs attention - payment was taken but some follow-up steps failed:
            </Text>
          </Box>
          <ul className="ml-7 mt-2 list-disc text-sm text-surface-800">
            {order.fulfillmentErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Box>
      ) : null}

      <Box className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Section title="Customer">
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
            {fullNameOf(order.customer)}
          </Text>
          <Muted>{order.customer.email}</Muted>
        </Section>
        <Section title="Payment">
          <Muted>
            {order.kind === 'manual'
              ? `Recorded by ${order.createdBy ? fullNameOf(order.createdBy) : 'staff'} - paid outside the store`
              : `${order.payment.provider}${paymentReference ? ` · ${paymentReference}` : ''}`}
          </Muted>
          {order.discount ? (
            <Box>
              <Pill color={{ color: 'surface', intensity: 200 }} className="font-mono text-surface-900">
                {order.discount.code}
              </Pill>
            </Box>
          ) : null}
        </Section>
      </Box>

      <Section title="Items">
        {order.lines.map((line) => (
          <Box key={line.id} flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }}>
            <Box flex={{ direction: 'col' }} className="min-w-0">
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm font-medium">
                {line.name}
              </Text>
              <Muted>{`${line.quantity} × ${formatMoney(line.unitAmountCents, currency)}${line.billing.type === 'recurring' ? ' · recurring' : ''}`}</Muted>
            </Box>
            <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm tabular-nums">
              {formatMoney(line.subtotalCents - line.discountCents, currency)}
            </Text>
          </Box>
        ))}
        <Divider color={{ color: 'surface', intensity: 300 }} />
        <TotalRow label="Subtotal" value={formatMoney(totals.subtotalCents, currency)} />
        {totals.discountCents > 0 ? <TotalRow label="Discount" value={`-${formatMoney(totals.discountCents, currency)}`} /> : null}
        {order.shipping ? <TotalRow label={`Shipping (${order.shipping.name})`} value={formatMoney(totals.shippingCents, currency)} /> : null}
        <TotalRow label="Tax" value={formatMoney(totals.taxCents, currency)} />
        <TotalRow label="Total" value={formatMoney(totals.totalCents, currency)} strong />
      </Section>

      {order.shippingAddress || order.billingAddress ? (
        <Box className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {order.shippingAddress ? (
            <Section title="Ship to">
              <AddressLines address={order.shippingAddress} />
            </Section>
          ) : null}
          {order.billingAddress ? (
            <Section title="Billing">
              <AddressLines address={order.billingAddress} />
            </Section>
          ) : null}
        </Box>
      ) : null}

      <StatusActions order={order} />
      <Bookkeeping order={order} />

      <Section title="History">
        {order.statusHistory.map((change, index) => (
          <Box key={`${change.status}-${index}`} flex={{ direction: 'row', gap: 12 }}>
            <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="w-44 shrink-0 text-xs tabular-nums">
              {formatDateTime(change.at)}
            </Text>
            <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-xs">
              {`${change.status}${change.note ? ` - ${change.note}` : ''}`}
            </Text>
          </Box>
        ))}
      </Section>
    </Box>
  );
};
