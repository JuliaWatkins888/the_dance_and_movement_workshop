import type { OrderEntity, UserEntity } from '@inithium/db';

const escapeCsvField = (value: string): string => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const toCsvRow = (fields: string[]): string => fields.map(escapeCsvField).join(',');

// Minor units -> a plain decimal amount ("1234.50") in the currency's own fraction digits, with no
// symbol or grouping, so spreadsheets and accounting imports read it as a number.
const toMajorUnits = (amountMinor: number, currency: string): string => {
  const digits = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).resolvedOptions().maximumFractionDigits ?? 2;
  return (amountMinor / 10 ** digits).toFixed(digits);
};

const HEADER = [
  'Order ID',
  'Created',
  'Paid',
  'Kind',
  'Status',
  'Customer',
  'Email',
  'Items',
  'Subtotal',
  'Discount',
  'Promo Code',
  'Shipping',
  'Tax',
  'Total',
  'Currency',
  'Payment Provider',
  'Payment Reference',
  'Tracking Number',
];

// One row per order - the shape an accountant reconciles against the payment processor. Amounts
// are the order's recorded totals; refunded/cancelled orders stay in with their status so the
// export matches what was actually charged at the time.
export const buildOrdersCsv = (orders: OrderEntity[], usersById: Map<string, UserEntity>): string => {
  const rows = orders.map((order) => {
    const user = usersById.get(order.userId);
    const { totals, currency } = order;
    return toCsvRow([
      order.id,
      order.createdAt.toISOString(),
      order.paidAt ? order.paidAt.toISOString() : '',
      order.kind,
      order.status,
      user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : '',
      user?.email ?? '',
      order.lines.map((line) => `${line.quantity} x ${line.name}`).join('; '),
      toMajorUnits(totals.subtotalCents, currency),
      toMajorUnits(totals.discountCents, currency),
      order.discount?.code ?? '',
      toMajorUnits(totals.shippingCents, currency),
      toMajorUnits(totals.taxCents, currency),
      toMajorUnits(totals.totalCents, currency),
      currency.toUpperCase(),
      order.payment.provider,
      order.payment.paymentId ?? order.payment.invoiceId ?? '',
      order.trackingNumber ?? '',
    ]);
  });
  return [toCsvRow(HEADER), ...rows].join('\r\n');
};
