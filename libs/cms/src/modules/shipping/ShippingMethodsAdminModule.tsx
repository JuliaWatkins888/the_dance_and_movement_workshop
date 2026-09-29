import { useState } from 'react';
import { alert, Box, Button, IconButton, Input, ListRow, Pill, Switch, Text, dialog } from '@inithium/ui';
import {
  formatMinorUnitsForInput,
  formatMoney,
  parseMinorUnitsInput,
  readApiError,
  useCreateShippingMethodMutation,
  useDeleteShippingMethodMutation,
  useListShippingMethodsAdminQuery,
  useUpdateShippingMethodMutation,
} from '@inithium/api-client';
import type { AdminShippingMethodDto } from '@inithium/api-client';
import { DIALOG_WIDTH, EmptyState, FormError, MoneyInput, useStoreCurrency } from '../ecommerce/shared';

const ALERT_POSITION = 'bottom-right' as const;

interface ShippingMethodDialogProps {
  readonly method?: AdminShippingMethodDto;
  readonly nextSortOrder: number;
  readonly onDone: () => void;
}

const ShippingMethodDialog = ({ method, nextSortOrder, onDone }: ShippingMethodDialogProps) => {
  const currency = useStoreCurrency();
  const [createMethod, { isLoading: isCreating }] = useCreateShippingMethodMutation();
  const [updateMethod, { isLoading: isUpdating }] = useUpdateShippingMethodMutation();
  const isSaving = isCreating || isUpdating;

  const [name, setName] = useState(method?.name ?? '');
  const [description, setDescription] = useState(method?.description ?? '');
  const [amount, setAmount] = useState(formatMinorUnitsForInput(method?.amountCents, currency));
  const [freeOver, setFreeOver] = useState(formatMinorUnitsForInput(method?.freeOverCents, currency));
  const [requiresAddress, setRequiresAddress] = useState(method?.requiresAddress ?? true);
  const [isActive, setIsActive] = useState(method?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(String(method?.sortOrder ?? nextSortOrder));
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSubmit = async () => {
    setError(undefined);
    if (!name.trim()) return setError('Name is required.');
    const amountCents = parseMinorUnitsInput(amount, currency);
    if (amountCents === null) return setError('Enter a valid price (0 for free).');
    const freeOverCents = freeOver.trim() ? parseMinorUnitsInput(freeOver, currency) : null;
    if (freeOver.trim() && freeOverCents === null) return setError('Enter a valid free-shipping threshold.');
    if (!/^-?\d+$/.test(sortOrder.trim())) return setError('Display order must be a whole number.');

    const input = {
      name: name.trim(),
      amountCents,
      requiresAddress,
      isActive,
      sortOrder: Number(sortOrder),
    };
    try {
      if (method) {
        await updateMethod({ id: method.id, ...input, description: description.trim() || null, freeOverCents }).unwrap();
      } else {
        await createMethod({
          ...input,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(freeOverCents !== null ? { freeOverCents } : {}),
        }).unwrap();
      }
      onDone();
    } catch (saveError) {
      setError(readApiError(saveError, 'Could not save this shipping method.').message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Input label="Name" required placeholder="Standard" value={name} onChange={(event) => setName(event.target.value)} />
      <Input label="Description" placeholder="3-5 business days" value={description} onChange={(event) => setDescription(event.target.value)} />
      <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoneyInput label="Price" required currency={currency} value={amount} onChange={setAmount} helperText="0 for free" />
        <MoneyInput
          label="Free over"
          currency={currency}
          value={freeOver}
          onChange={setFreeOver}
          placeholder=""
          helperText="Free once the discounted subtotal reaches this. Blank = never."
        />
        <Input label="Display order" inputMode="numeric" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
      </Box>
      <Switch label="Collect a shipping address (turn off for pickup)" checked={requiresAddress} onCheckedChange={setRequiresAddress} />
      <Switch label="Offered at checkout" checked={isActive} onCheckedChange={setIsActive} />
      <FormError message={error} />
      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onDone} disabled={isSaving}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};

export const ShippingMethodsAdminModule = () => {
  const currency = useStoreCurrency();
  const { data: methods = [], isLoading } = useListShippingMethodsAdminQuery();
  const [deleteMethod] = useDeleteShippingMethodMutation();
  const nextSortOrder = methods.reduce((max, method) => Math.max(max, method.sortOrder + 1), 0);

  const openEditor = (method?: AdminShippingMethodDto) => {
    const id = dialog.show(() => <ShippingMethodDialog method={method} nextSortOrder={nextSortOrder} onDone={() => dialog.close(id)} />, {
      title: method ? `Edit "${method.name}"` : 'New Shipping Method',
      width: DIALOG_WIDTH,
    });
  };

  const handleDelete = async (method: AdminShippingMethodDto) => {
    const confirmed = await dialog.confirm({
      title: `Delete "${method.name}"?`,
      description: 'Customers will no longer be able to choose it. Past orders keep the shipping they paid for. To hide it temporarily, edit it and turn off "Offered at checkout".',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    try {
      await deleteMethod(method.id).unwrap();
    } catch (error) {
      alert.danger(readApiError(error, 'Could not delete this shipping method.').message, { position: ALERT_POSITION });
    }
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
        <Box flex={{ direction: 'col', gap: 4 }}>
          <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
            Shipping
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
            Offered at checkout, in display order, whenever an order has an item that ships.
          </Text>
        </Box>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => openEditor()}>
          Add Shipping Method
        </Button>
      </Box>

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <EmptyState message="Loading shipping methods..." />
        ) : methods.length > 0 ? (
          methods.map((method) => (
            <ListRow
              key={method.id}
              trailing={
                <>
                  <IconButton icon="PencilSimple" label={`Edit ${method.name}`} onClick={() => openEditor(method)} />
                  <IconButton icon="Trash" label={`Delete ${method.name}`} textColor={{ color: 'red', intensity: 600 }} onClick={() => handleDelete(method)} />
                </>
              }
            >
              <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
                <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
                  {method.name}
                </Text>
                {!method.isActive ? (
                  <Pill color={{ color: 'surface', intensity: 200 }} className="text-surface-800">
                    Hidden
                  </Pill>
                ) : null}
              </Box>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                {[
                  method.amountCents === 0 ? 'Free' : formatMoney(method.amountCents, currency),
                  method.freeOverCents !== undefined ? `free over ${formatMoney(method.freeOverCents, currency)}` : '',
                  method.requiresAddress ? 'ships to an address' : 'pickup (no address)',
                  method.description ?? '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </ListRow>
          ))
        ) : (
          <EmptyState message="No shipping methods yet. Products that ship can't be checked out until you add one." />
        )}
      </Box>
    </Box>
  );
};
