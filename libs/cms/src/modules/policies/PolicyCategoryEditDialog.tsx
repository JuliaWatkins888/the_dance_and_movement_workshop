import { useState } from 'react';
import { Box, Button, IconPicker, Input, Text } from '@inithium/ui';
import { useCreatePolicyCategoryMutation, useUpdatePolicyCategoryMutation } from '@inithium/api-client';
import type { PolicyCategoryDto } from '@inithium/api-client';

export interface PolicyCategoryEditDialogProps {
  readonly mode: 'create' | 'edit';
  readonly initialCategory?: PolicyCategoryDto;
  readonly onDone: () => void;
}

export const PolicyCategoryEditDialog = ({ mode, initialCategory, onDone }: PolicyCategoryEditDialogProps) => {
  const [createCategory, { isLoading: isCreating }] = useCreatePolicyCategoryMutation();
  const [updateCategory, { isLoading: isUpdating }] = useUpdatePolicyCategoryMutation();
  const isLoading = isCreating || isUpdating;
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const [title, setTitle] = useState(initialCategory?.title ?? '');
  const [icon, setIcon] = useState(initialCategory?.icon ?? '');
  const [order, setOrder] = useState(String(initialCategory?.order ?? 0));

  const handleSubmit = async () => {
    setSubmitError(undefined);

    const parsedOrder = Number(order);
    const input = {
      title,
      icon: icon || undefined,
      order: Number.isFinite(parsedOrder) ? parsedOrder : 0,
    };

    try {
      if (mode === 'create') {
        await createCategory(input).unwrap();
      } else if (initialCategory) {
        await updateCategory({ id: initialCategory.id, ...input }).unwrap();
      }
      onDone();
    } catch {
      setSubmitError('Could not save this category. Check the fields and try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Input label="Title" required value={title} onChange={(event) => setTitle(event.target.value)} />

      <IconPicker label="Icon" helperText="Shown next to this category on the public policies page." value={icon} onValueChange={setIcon} />

      <Input label="Display Order" type="number" value={order} onChange={(event) => setOrder(event.target.value)} />

      {submitError ? (
        <Text as="p" textColor={{ color: 'red', intensity: 600 }} className="text-sm">
          {submitError}
        </Text>
      ) : null}

      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onDone} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};
