import { Box, Button, Loader, Text } from '@inithium/ui';
import { formatMoney, useListOutstandingBalancesQuery } from '@inithium/api-client';
import { fullNameOf, useStoreCurrency } from '../../modules/ecommerce/shared';
import { openAccountLedger } from '../../modules/ledger/openAccountLedger';
import type { DashboardWidget } from './registry';

const TOP_ACCOUNTS = 5;

const OutstandingBalancesWidget = () => {
  const currency = useStoreCurrency();
  const { data: accounts = [], isLoading } = useListOutstandingBalancesQuery(TOP_ACCOUNTS);

  if (isLoading) return <Loader variant="spinner" size="2rem" />;

  if (accounts.length === 0) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
        No family owes a balance right now.
      </Text>
    );
  }

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      {accounts.map(({ customer, balanceCents }) => (
        <Box
          key={customer.id}
          flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }}
          borderColor={{ color: 'surface', intensity: 200 }}
          padding={{ base: 8 }}
          className="rounded border"
        >
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="min-w-0 truncate font-medium">
            {fullNameOf(customer)}
          </Text>
          <Box flex={{ direction: 'row', align: 'center', gap: 12 }} className="shrink-0">
            <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold tabular-nums">
              {formatMoney(balanceCents, currency)}
            </Text>
            <Button
              variant={{ kind: 'ghost', color: 'surface' }}
              textColor={{ color: 'surface', intensity: 900 }}
              onClick={() => openAccountLedger(customer.id, fullNameOf(customer))}
            >
              Open
            </Button>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

const outstandingBalancesWidget: DashboardWidget = {
  id: 'outstanding-balances',
  title: 'Outstanding Balances',
  order: 15,
  requiredCapability: 'ledger:manage',
  Component: OutstandingBalancesWidget,
};

export default outstandingBalancesWidget;
