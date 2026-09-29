import { Box, Button, Divider, Text, useNavigateWithTransition } from '@inithium/ui';
import { describeRenewal, formatDate, formatMoney } from '@inithium/api-client';
import type { OrderDto, PostalAddressInput } from '@inithium/api-client';
import { OrderStatusPill } from './OrderStatusPill';
import { PriceSummary } from './PriceSummary';
import { ProductImage } from './ProductImage';

export const shortOrderNumber = (order: OrderDto): string => order.id.slice(-8).toUpperCase();

const AddressBlock = ({ title, address }: { readonly title: string; readonly address: PostalAddressInput }) => (
  <Box flex={{ direction: 'col', gap: 4 }}>
    <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="text-sm font-semibold">
      {title}
    </Text>
    {[address.name, address.line1, address.line2, [address.city, address.state, address.postalCode].filter(Boolean).join(', '), address.country]
      .filter(Boolean)
      .map((line) => (
        <Text key={line} as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          {line}
        </Text>
      ))}
  </Box>
);

interface OrderDetailsProps {
  readonly order: OrderDto;
  // Line titles navigate to their item; a dialog host passes its own close so the dialog goes away.
  readonly onNavigate?: () => void;
}

export const OrderDetails = ({ order, onNavigate }: OrderDetailsProps) => {
  const navigate = useNavigateWithTransition();
  const { currency, totals } = order;

  return (
    <Box flex={{ direction: 'col', gap: 24 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', wrap: 'wrap', gap: 12 }}>
        <Box flex={{ direction: 'col', gap: 2 }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
            {`Order #${shortOrderNumber(order)}${order.kind === 'renewal' ? ' · Renewal' : ''}`}
          </Text>
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
            {`Placed ${formatDate(order.createdAt)}`}
          </Text>
        </Box>
        <OrderStatusPill status={order.status} />
      </Box>

      <Box>
        {order.lines.map((line, index) => {
          const renewal = describeRenewal(line.billing, line.quantity, currency);
          return (
            <Box key={line.id}>
              {index > 0 ? <Divider color={{ color: 'surface', intensity: 300 }} /> : null}
              <Box flex={{ direction: 'row', align: 'center', gap: 12 }} padding={{ top: 12, bottom: 12 }}>
                <Box className="h-14 w-14 shrink-0 overflow-hidden rounded-md">
                  <ProductImage src={line.imageUrl} alt={line.name} />
                </Box>
                <Box flex={{ direction: 'col', gap: 2 }} className="min-w-0 flex-1">
                  {line.href ? (
                    <Button
                      variant={{ kind: 'link', color: 'accent' }}
                      textColor={{ color: 'surface', intensity: 950 }}
                      className="justify-start p-0 text-left text-sm font-medium"
                      onClick={() => {
                        onNavigate?.();
                        navigate(line.href!);
                      }}
                    >
                      {line.name}
                    </Button>
                  ) : (
                    <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm font-medium">
                      {line.name}
                    </Text>
                  )}
                  <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
                    {`Qty ${line.quantity} · ${formatMoney(line.unitAmountCents, currency)} each`}
                  </Text>
                  {renewal && order.kind === 'checkout' ? (
                    <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
                      {renewal}
                    </Text>
                  ) : null}
                </Box>
                <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm font-medium tabular-nums">
                  {formatMoney(line.subtotalCents - line.discountCents, currency)}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      <PriceSummary
        currency={currency}
        rows={[
          { label: 'Subtotal', amountCents: totals.subtotalCents },
          ...(totals.discountCents > 0
            ? [{ label: `Discount${order.discount ? ` (${order.discount.code})` : ''}`, amountCents: totals.discountCents, isDeduction: true }]
            : []),
          ...(order.shipping ? [{ label: `Shipping (${order.shipping.name})`, amountCents: totals.shippingCents }] : []),
          { label: 'Tax', amountCents: totals.taxCents },
        ]}
        totalLabel={order.status === 'pending' || order.status === 'failed' ? 'Total' : 'Total paid'}
        totalCents={totals.totalCents}
      />

      {order.shippingAddress || order.billingAddress ? (
        <Box className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {order.shippingAddress ? <AddressBlock title="Shipping address" address={order.shippingAddress} /> : null}
          {order.billingAddress ? <AddressBlock title="Billing address" address={order.billingAddress} /> : null}
        </Box>
      ) : null}
    </Box>
  );
};
