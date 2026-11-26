import { useNavigate } from 'react-router-dom';
import { Box, Button, Loader, Text } from '@inithium/ui';
import { useGetPaymentHealthQuery } from '@inithium/api-client';
import { LevelBadge, LevelIcon } from '../../modules/payment-health/healthDisplay';
import type { DashboardWidget } from './registry';

const MAX_CHECKS_SHOWN = 3;

const PaymentHealthWidget = () => {
  const navigate = useNavigate();
  const { data: health, isLoading, isError } = useGetPaymentHealthQuery();

  if (isLoading) return <Loader variant="spinner" size="2rem" />;

  const problems = (health?.checks ?? []).filter((check) => check.level !== 'ok');

  return (
    <Box flex={{ direction: 'col', gap: 12 }}>
      {health ? (
        <Box flex={{ direction: 'row' }}>
          <LevelBadge level={health.status} />
        </Box>
      ) : null}

      {isError && !health ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
          Could not run the payment check.
        </Text>
      ) : problems.length === 0 ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
          Stripe keys, webhook and recent payments look fine.
        </Text>
      ) : (
        <Box flex={{ direction: 'col', gap: 8 }}>
          {problems.slice(0, MAX_CHECKS_SHOWN).map((check) => (
            <Box key={check.id} flex={{ direction: 'row', align: 'start', gap: 8 }}>
              <LevelIcon level={check.level} size={18} />
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm">
                {check.title}
              </Text>
            </Box>
          ))}
          {problems.length > MAX_CHECKS_SHOWN ? (
            <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
              {`and ${problems.length - MAX_CHECKS_SHOWN} more`}
            </Text>
          ) : null}
        </Box>
      )}

      <Box flex={{ direction: 'row' }}>
        <Button
          variant={{ kind: 'outlined', color: 'surface', intensity: 400 }}
          textColor={{ color: 'surface', intensity: 900 }}
          onClick={() => navigate('/cms/payment-health')}
        >
          Open Payment Health
        </Button>
      </Box>
    </Box>
  );
};

const paymentHealthWidget: DashboardWidget = {
  id: 'payment-health',
  title: 'Payment Health',
  order: 1,
  requiredCapability: 'ecommerce:manage-orders',
  Component: PaymentHealthWidget,
};

export default paymentHealthWidget;
