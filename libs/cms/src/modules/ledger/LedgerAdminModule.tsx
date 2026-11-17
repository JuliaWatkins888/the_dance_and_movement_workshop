import { useEffect, useState } from 'react';
import { alert, Box, Button, Input, ListRow, Select, SelectItem, Text } from '@inithium/ui';
import {
  downloadLedgerPaymentsCsv,
  formatMoney,
  LEDGER_METHOD_LABELS,
  useListOutstandingBalancesQuery,
  useSearchLedgerAccountsQuery,
} from '@inithium/api-client';
import type { LedgerAccountSummaryDto, LedgerPaymentMethod } from '@inithium/api-client';
import { EmptyState, fullNameOf, useStoreCurrency } from '../ecommerce/shared';
import { openAccountLedger } from './openAccountLedger';

const OUTSTANDING_LIMIT = 25;
const SEARCH_DEBOUNCE_MS = 300;
const ALL = 'all';
const ALERT_POSITION = 'bottom-right' as const;
const METHODS = Object.keys(LEDGER_METHOD_LABELS) as LedgerPaymentMethod[];

const AccountRows = ({ accounts, currency }: { readonly accounts: LedgerAccountSummaryDto[]; readonly currency: string }) => (
  <>
    {accounts.map(({ customer, balanceCents }) => (
      <ListRow
        key={customer.id}
        trailing={
          <Box flex={{ direction: 'row', align: 'center', gap: 12 }}>
            <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="w-24 text-right font-semibold tabular-nums">
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
        }
      >
        <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="truncate font-medium">
          {fullNameOf(customer)}
        </Text>
        <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="truncate text-sm">
          {customer.email}
        </Text>
      </ListRow>
    ))}
  </>
);

const PaymentsExport = () => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [method, setMethod] = useState<LedgerPaymentMethod | typeof ALL>(ALL);
  const [isExporting, setIsExporting] = useState(false);

  const exportCsv = async () => {
    if (!fromDate || !toDate) {
      alert.danger('Choose both a from and a to date.', { position: ALERT_POSITION });
      return;
    }
    setIsExporting(true);
    try {
      await downloadLedgerPaymentsCsv({ from: fromDate, to: toDate, ...(method !== ALL ? { method } : {}) });
    } catch {
      alert.danger('The export failed. Please try again.', { position: ALERT_POSITION });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 8 }} borderColor={{ color: 'surface', intensity: 200 }} padding={{ base: 16 }} className="rounded border">
      <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
        Export payments
      </Text>
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
        Download payments received in a date range to match against your cash and check deposits.
      </Text>
      <Box className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="From" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        <Input label="To" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        <Select label="Method" value={method} onValueChange={(next) => setMethod(next as LedgerPaymentMethod | typeof ALL)}>
          <SelectItem value={ALL}>All methods</SelectItem>
          {METHODS.map((candidate) => (
            <SelectItem key={candidate} value={candidate}>
              {LEDGER_METHOD_LABELS[candidate]}
            </SelectItem>
          ))}
        </Select>
        <Button variant={{ kind: 'outlined', color: 'surface', intensity: 400 }} textColor={{ color: 'surface', intensity: 900 }} disabled={isExporting} onClick={exportCsv}>
          {isExporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </Box>
    </Box>
  );
};

export const LedgerAdminModule = () => {
  const currency = useStoreCurrency();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  const isSearching = debounced.length >= 2;
  const outstanding = useListOutstandingBalancesQuery(OUTSTANDING_LIMIT, { skip: isSearching });
  const results = useSearchLedgerAccountsQuery(debounced, { skip: !isSearching });
  const active = isSearching ? results : outstanding;

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'col', gap: 4 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Accounts
        </Text>
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
          Add charges like costumes, record cash and check payments, and see what each family owes.
        </Text>
      </Box>

      <Input aria-label="Search accounts" placeholder="Search a family by name or email…" value={search} onChange={(event) => setSearch(event.target.value)} />

      <Box flex={{ direction: 'col', gap: 8 }}>
        <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
          {isSearching ? 'Search results' : 'Outstanding balances'}
        </Text>
        <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
          {active.isLoading ? (
            <EmptyState message="Loading accounts..." />
          ) : active.data && active.data.length > 0 ? (
            <AccountRows accounts={active.data} currency={currency} />
          ) : (
            <EmptyState message={isSearching ? 'No matching accounts.' : 'No family owes a balance right now.'} />
          )}
        </Box>
      </Box>

      <PaymentsExport />
    </Box>
  );
};
