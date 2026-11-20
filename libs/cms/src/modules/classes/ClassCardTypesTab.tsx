import { useState } from 'react';
import { Box, Button, IconButton, Input, ListRow, Pill, Switch, Text, alert, dialog } from '@inithium/ui';
import {
  formatMinorUnitsForInput,
  formatMoney,
  parseMinorUnitsInput,
  readApiError,
  useCreateClassCardTypeMutation,
  useDeleteClassCardTypeMutation,
  useListClassCardTypesAdminQuery,
  useUpdateClassCardTypeMutation,
} from '@inithium/api-client';
import type { ClassCardTypeDto } from '@inithium/api-client';
import { EmptyState, FormError, MoneyInput, useStoreCurrency } from '../ecommerce/shared';
import { ALERT_POSITION, DIALOG_WIDTH } from './classAdmin.shared';

interface ClassCardTypeDialogProps {
  readonly cardType?: ClassCardTypeDto;
  readonly onDone: () => void;
}

const ClassCardTypeDialog = ({ cardType, onDone }: ClassCardTypeDialogProps) => {
  const currency = useStoreCurrency();
  const [createCardType, { isLoading: isCreating }] = useCreateClassCardTypeMutation();
  const [updateCardType, { isLoading: isUpdating }] = useUpdateClassCardTypeMutation();
  const isSaving = isCreating || isUpdating;
  const [error, setError] = useState<string | undefined>(undefined);

  const [name, setName] = useState(cardType?.name ?? '');
  const [classCount, setClassCount] = useState(cardType ? String(cardType.classCount) : '');
  const [price, setPrice] = useState(formatMinorUnitsForInput(cardType?.priceCents, currency));
  const [isActive, setIsActive] = useState(cardType?.isActive ?? true);

  const handleSubmit = async () => {
    setError(undefined);
    const count = Number(classCount);
    const priceCents = parseMinorUnitsInput(price, currency);
    if (!name.trim()) return setError('Name is required.');
    if (!Number.isInteger(count) || count < 1) return setError('Enter a whole number of classes (1 or more).');
    if (priceCents === null) return setError('Enter a valid price.');

    const input = { name: name.trim(), classCount: count, priceCents, isActive };
    try {
      if (cardType) await updateCardType({ id: cardType.id, ...input }).unwrap();
      else await createCardType(input).unwrap();
      onDone();
    } catch (saveError) {
      setError(readApiError(saveError, 'Could not save this class card.').message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Input label="Name" required placeholder="e.g. 5-Class Card" value={name} onChange={(event) => setName(event.target.value)} />
      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input
          label="Classes"
          required
          type="number"
          min={1}
          step="1"
          value={classCount}
          onChange={(event) => setClassCount(event.target.value)}
          className="flex-1"
        />
        <MoneyInput label="Price" required currency={currency} value={price} onChange={setPrice} className="flex-1" />
      </Box>
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
        Cards never expire and can be used in any adult (18+) class. Changing the price or class count only affects cards bought
        afterwards.
      </Text>
      <Switch label="For sale (shown on adult class pages and at the front desk)" checked={isActive} onCheckedChange={setIsActive} />
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

export const ClassCardTypesTab = () => {
  const currency = useStoreCurrency();
  const { data: cardTypes = [], isLoading } = useListClassCardTypesAdminQuery();
  const [deleteCardType] = useDeleteClassCardTypeMutation();

  const openDialog = (cardType?: ClassCardTypeDto) => {
    const id = dialog.show(() => <ClassCardTypeDialog cardType={cardType} onDone={() => dialog.close(id)} />, {
      title: cardType ? `Edit "${cardType.name}"` : 'New Class Card',
      width: DIALOG_WIDTH,
    });
  };

  const handleDelete = async (cardType: ClassCardTypeDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this class card?',
      description: `This removes "${cardType.name}". A card type that has been sold can’t be deleted; turn off "For sale" instead.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    try {
      await deleteCardType(cardType.id).unwrap();
    } catch (error) {
      alert.danger(readApiError(error, 'Could not delete this class card.').message, { position: ALERT_POSITION });
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }} className="flex-wrap">
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="max-w-2xl text-sm">
          Prepaid packs of adult classes. Adults buy them on any adult class page or at the front desk, and staff use one class at a
          time from the Check-in screen.
        </Text>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => openDialog()}>
          Add Class Card
        </Button>
      </Box>

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <EmptyState message="Loading class cards..." />
        ) : cardTypes.length === 0 ? (
          <EmptyState message="No class cards yet." />
        ) : (
          cardTypes.map((cardType) => (
            <ListRow
              key={cardType.id}
              trailing={
                <>
                  {!cardType.isActive ? (
                    <Pill color={{ color: 'surface', intensity: 300 }} className="text-surface-900">
                      Not for sale
                    </Pill>
                  ) : null}
                  <IconButton icon="PencilSimple" label={`Edit ${cardType.name}`} onClick={() => openDialog(cardType)} />
                  <IconButton
                    icon="Trash"
                    label={`Delete ${cardType.name}`}
                    textColor={{ color: 'red', intensity: 600 }}
                    onClick={() => handleDelete(cardType)}
                  />
                </>
              }
            >
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
                {cardType.name}
              </Text>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                {`${cardType.classCount} classes · ${formatMoney(cardType.priceCents, currency)} · never expires`}
              </Text>
            </ListRow>
          ))
        )}
      </Box>
    </Box>
  );
};
