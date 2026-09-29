import { useEffect, useState } from 'react';
import { Box, Button, Icon, Loader, Text, useNavigateWithTransition } from '@inithium/ui';
import { useGetMyOrderQuery, usePageParams } from '@inithium/api-client';
import type { OrderDto } from '@inithium/api-client';
import { useCurrentUser } from '../app/useCurrentUser';
import { OrderDetails } from './ecommerce/OrderDetails';
import { SignInPrompt } from './ecommerce/SignInPrompt';

// A payment still settling (status 'processing' from checkout) is finished by the payment
// webhook, usually within seconds - poll until the order leaves 'pending'.
const PENDING_POLL_MS = 3000;

const HEADINGS: Partial<Record<OrderDto['status'], { title: string; subtitle: string; icon: 'CheckCircle' | 'HourglassMedium' | 'XCircle' }>> = {
  paid: { title: 'Thank you for your order!', subtitle: 'Your payment was received.', icon: 'CheckCircle' },
  pending: { title: 'We’re confirming your payment', subtitle: 'This usually takes a few seconds. This page updates on its own.', icon: 'HourglassMedium' },
  failed: { title: 'Your payment didn’t go through', subtitle: 'Nothing was charged. Your items are still in your cart.', icon: 'XCircle' },
};

export const OrderPage = () => {
  const navigate = useNavigateWithTransition();
  const { id: orderId = '' } = usePageParams();
  const { currentUser, isResolving } = useCurrentUser();
  const [isPolling, setIsPolling] = useState(false);
  const { data: order, isLoading, isError } = useGetMyOrderQuery(
    { userId: currentUser?.id ?? '', orderId },
    { skip: !currentUser || !orderId, pollingInterval: isPolling ? PENDING_POLL_MS : 0, skipPollingIfUnfocused: true },
  );
  const isPending = order?.status === 'pending';
  useEffect(() => setIsPolling(isPending), [isPending]);

  if (isResolving || (currentUser && isLoading)) {
    return (
      <Box flex={{ justify: 'center' }} padding={{ base: 48 }}>
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      </Box>
    );
  }
  if (!currentUser) return <SignInPrompt message="Log in to see this order." redirectTo={`/orders/${orderId}`} />;
  if (isError || !order) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} padding={{ base: 32 }} className="text-center">
        We couldn’t find that order.
      </Text>
    );
  }

  const heading = HEADINGS[order.status];

  return (
    <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }} className="mx-auto w-full max-w-3xl">
      {heading ? (
        <Box flex={{ direction: 'col', align: 'center', gap: 8 }} className="text-center">
          {isPending ? (
            <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
          ) : (
            <Icon name={heading.icon} size={48} textColor={{ color: order.status === 'failed' ? 'surface' : 'primary', intensity: order.status === 'failed' ? 700 : 500 }} />
          )}
          <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
            {heading.title}
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
            {heading.subtitle}
          </Text>
        </Box>
      ) : (
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Order details
        </Text>
      )}

      <Box bgColor={{ color: 'surface', intensity: 200 }} padding={{ base: 24 }} className="rounded-lg">
        <OrderDetails order={order} />
      </Box>

      <Box flex={{ direction: 'row', justify: 'center', wrap: 'wrap', gap: 12 }}>
        {order.status === 'failed' ? (
          <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => navigate('/cart')}>
            Back to cart
          </Button>
        ) : (
          <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => navigate('/merch')}>
            Continue shopping
          </Button>
        )}
        <Button
          variant={{ kind: 'outlined', color: 'surface', intensity: 400 }}
          textColor={{ color: 'surface', intensity: 900 }}
          onClick={() => navigate(`/profile/${currentUser.id}?tab=orders`)}
        >
          View all orders
        </Button>
      </Box>
    </Box>
  );
};

export default OrderPage;
