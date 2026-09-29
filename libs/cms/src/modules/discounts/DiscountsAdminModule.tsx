import { useEffect, useState } from 'react';
import { alert, Box, Button, IconButton, Input, ListRow, Pagination, Pill, Text, dialog } from '@inithium/ui';
import { formatDate, formatMoney, readApiError, useDeleteDiscountMutation, useListDiscountsQuery } from '@inithium/api-client';
import type { DiscountDto } from '@inithium/api-client';
import { DIALOG_WIDTH_WIDE, EmptyState, useStoreCurrency } from '../ecommerce/shared';
import { DiscountEditDialog } from './DiscountEditDialog';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const ALERT_POSITION = 'bottom-right' as const;

type DiscountStatus = 'Active' | 'Scheduled' | 'Expired' | 'Used up' | 'Inactive';

export const discountStatusOf = (discount: DiscountDto, now = new Date()): DiscountStatus => {
  if (!discount.isActive) return 'Inactive';
  if (discount.maxRedemptions !== undefined && discount.timesRedeemed >= discount.maxRedemptions) return 'Used up';
  if (discount.endsAt && new Date(discount.endsAt) < now) return 'Expired';
  if (discount.startsAt && new Date(discount.startsAt) > now) return 'Scheduled';
  return 'Active';
};

const STATUS_CLASSES: Record<DiscountStatus, string> = {
  Active: 'bg-primary-500 text-primary-foreground-500',
  Scheduled: 'bg-surface-300 text-surface-900',
  Expired: 'bg-surface-300 text-surface-700',
  'Used up': 'bg-surface-300 text-surface-700',
  Inactive: 'bg-surface-300 text-surface-700',
};

const describeDiscount = (discount: DiscountDto, currency: string): string => {
  const amount = discount.kind === 'percent' ? `${discount.value}% off` : `${formatMoney(discount.value, currency)} off`;
  const target = discount.scope === 'order' ? 'whole order' : discount.target.categories.length > 0 ? discount.target.categories.join(', ') : 'selected items';
  const window = [discount.startsAt ? `from ${formatDate(discount.startsAt)}` : '', discount.endsAt ? `until ${formatDate(discount.endsAt)}` : '']
    .filter(Boolean)
    .join(' ');
  const uses = `${discount.timesRedeemed}${discount.maxRedemptions !== undefined ? ` / ${discount.maxRedemptions}` : ''} used`;
  return [amount, target, window, uses].filter(Boolean).join(' · ');
};

export const DiscountsAdminModule = () => {
  const currency = useStoreCurrency();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);
  useEffect(() => setPage(1), [debouncedSearch]);

  const { data, isLoading } = useListDiscountsQuery({ page, pageSize: PAGE_SIZE, ...(debouncedSearch ? { search: debouncedSearch } : {}) });
  const [deleteDiscount] = useDeleteDiscountMutation();

  const openEditor = (discount?: DiscountDto) => {
    const id = dialog.show(
      () => <DiscountEditDialog discount={discount} onDone={() => dialog.close(id)} onCancel={() => dialog.close(id)} />,
      { title: discount ? `Edit ${discount.code}` : 'New Discount', width: DIALOG_WIDTH_WIDE },
    );
  };

  const handleDelete = async (discount: DiscountDto) => {
    const confirmed = await dialog.confirm({
      title: `Delete ${discount.code}?`,
      description: 'The code stops working immediately. Past orders keep their discount, and subscriptions already discounted keep their terms. To pause a code instead, edit it and turn off Active.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    try {
      await deleteDiscount(discount.id).unwrap();
    } catch (error) {
      alert.danger(readApiError(error, 'Could not delete this discount.').message, { position: ALERT_POSITION });
    }
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Discounts
        </Text>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => openEditor()}>
          Add Discount
        </Button>
      </Box>

      <Input aria-label="Search codes" placeholder="Search by code..." value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <EmptyState message="Loading discounts..." />
        ) : data && data.items.length > 0 ? (
          data.items.map((discount) => {
            const status = discountStatusOf(discount);
            return (
              <ListRow
                key={discount.id}
                trailing={
                  <>
                    <IconButton icon="PencilSimple" label={`Edit ${discount.code}`} onClick={() => openEditor(discount)} />
                    <IconButton
                      icon="Trash"
                      label={`Delete ${discount.code}`}
                      textColor={{ color: 'red', intensity: 600 }}
                      onClick={() => handleDelete(discount)}
                    />
                  </>
                }
              >
                <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
                  <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-mono font-medium">
                    {discount.code}
                  </Text>
                  <Pill color={{ color: 'surface', intensity: 300 }} className={STATUS_CLASSES[status]}>
                    {status}
                  </Pill>
                </Box>
                <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                  {describeDiscount(discount, currency)}
                </Text>
              </ListRow>
            );
          })
        ) : (
          <EmptyState message={debouncedSearch ? 'No codes match your search.' : 'No discounts yet. Add your first promo code.'} />
        )}
      </Box>

      {data && data.totalPages > 1 ? <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};
