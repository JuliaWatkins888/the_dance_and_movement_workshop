import { useState } from 'react';
import { alert, Box, Button, Divider, Loader, Pagination, Text, useNavigateWithTransition } from '@inithium/ui';
import {
  formatCalendarDate,
  formatDate,
  formatMoney,
  LEDGER_BALANCE_SOURCE_TYPE,
  LEDGER_CATEGORY_LABELS,
  LEDGER_METHOD_LABELS,
  readApiError,
  useAddCartLineMutation,
  useGetMyLedgerQuery,
} from '@inithium/api-client';
import type { LedgerEntryDto } from '@inithium/api-client';
import type { ProfileTabDescriptor, ProfileTabProps } from './registry';

const PAGE_SIZE = 15;

const entryDetails = (entry: LedgerEntryDto): string =>
  [
    entry.kind === 'charge' && entry.category ? LEDGER_CATEGORY_LABELS[entry.category] : undefined,
    entry.studentName,
    entry.method ? LEDGER_METHOD_LABELS[entry.method] : undefined,
    entry.checkNumber ? `Check #${entry.checkNumber}` : undefined,
    entry.dueDate ? `Due ${formatCalendarDate(entry.dueDate)}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

const EntryRow = ({ entry, currency }: { readonly entry: LedgerEntryDto; readonly currency: string }) => {
  const isVoided = Boolean(entry.voidedAt);
  // Staff-recorded payments carry the day the money was received rather than the day it was keyed.
  const date = entry.receivedAt && entry.source === 'staff' ? formatCalendarDate(entry.receivedAt) : formatDate(entry.createdAt);
  // Payments read as money coming off the balance, so their sign is flipped for display.
  const signedAmount = entry.kind === 'payment' ? -entry.amountCents : entry.amountCents;

  return (
    <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }} className="py-3">
      <Box flex={{ direction: 'col', gap: 2 }} className="min-w-0 flex-1">
        <Text as="span" textColor={{ color: 'surface', intensity: isVoided ? 600 : 950 }} className={`font-medium ${isVoided ? 'line-through' : ''}`}>
          {entry.description}
        </Text>
        <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          {[date, entryDetails(entry)].filter(Boolean).join(' · ')}
        </Text>
        {entry.voidedAt ? (
          <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-xs">
            {`Voided: ${entry.voidReason ?? ''}`}
          </Text>
        ) : null}
      </Box>
      <Text as="span" textColor={{ color: 'surface', intensity: isVoided ? 600 : 950 }} className={`font-semibold tabular-nums ${isVoided ? 'line-through' : ''}`}>
        {formatMoney(signedAmount, currency)}
      </Text>
    </Box>
  );
};

// The family's own balance and history, and the way to pay what's owed by card.
const BillingTab = ({ profile }: ProfileTabProps) => {
  const [page, setPage] = useState(1);
  const navigate = useNavigateWithTransition();
  const { data: ledger, isLoading } = useGetMyLedgerQuery({ userId: profile.id, page, pageSize: PAGE_SIZE }, { refetchOnMountOrArgChange: true });
  const [addCartLine, { isLoading: isAdding }] = useAddCartLineMutation();

  if (isLoading || !ledger) {
    return (
      <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      </Box>
    );
  }

  const { currency, balanceCents, openCharges, entries } = ledger;
  const payableCents = openCharges.reduce((sum, charge) => sum + charge.remainingCents, 0);

  const payBalance = async () => {
    try {
      await addCartLine({
        sourceType: LEDGER_BALANCE_SOURCE_TYPE,
        sourceId: profile.id,
        options: { chargeIds: openCharges.map((charge) => charge.chargeId).join(',') },
        quantity: 1,
      }).unwrap();
      navigate('/cart');
    } catch (error) {
      alert.danger(readApiError(error, 'Could not start this payment. Please try again.').message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box
        bgColor={{ color: 'surface', intensity: 200 }}
        padding={{ base: 16 }}
        flex={{ direction: 'row', justify: 'between', align: 'center', wrap: 'wrap', gap: 12 }}
        className="rounded-md"
      >
        <Box flex={{ direction: 'col', gap: 2 }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
            {balanceCents < 0 ? 'Account credit' : 'Balance due'}
          </Text>
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold tabular-nums">
            {formatMoney(Math.abs(balanceCents), currency)}
          </Text>
        </Box>
        {payableCents > 0 ? (
          <Button variant={{ kind: 'filled', color: 'primary' }} disabled={isAdding} onClick={payBalance}>
            {isAdding ? 'Adding…' : `Pay ${formatMoney(payableCents, currency)}`}
          </Button>
        ) : null}
      </Box>

      {openCharges.length > 0 ? (
        <Box flex={{ direction: 'col', gap: 4 }}>
          <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
            What’s owed
          </Text>
          {openCharges.map((charge) => (
            <Box key={charge.chargeId} flex={{ direction: 'row', justify: 'between', gap: 16 }}>
              <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
                {[charge.description, charge.studentName, charge.dueDate ? `Due ${formatCalendarDate(charge.dueDate)}` : undefined].filter(Boolean).join(' · ')}
              </Text>
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm tabular-nums">
                {formatMoney(charge.remainingCents, currency)}
              </Text>
            </Box>
          ))}
        </Box>
      ) : null}

      <Box flex={{ direction: 'col' }}>
        <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
          History
        </Text>
        {entries.length === 0 ? (
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="py-3">
            Nothing on your account yet.
          </Text>
        ) : (
          entries.map((entry, index) => (
            <Box key={entry.id}>
              {index > 0 ? <Divider color={{ color: 'surface', intensity: 300 }} /> : null}
              <EntryRow entry={entry} currency={currency} />
            </Box>
          ))
        )}
      </Box>

      {ledger.totalPages > 1 ? <Pagination page={ledger.page} totalPages={ledger.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};

const billingTab: ProfileTabDescriptor = {
  id: 'billing',
  label: 'Billing',
  order: 16,
  visibility: 'owned',
  Component: BillingTab,
};

export default billingTab;
