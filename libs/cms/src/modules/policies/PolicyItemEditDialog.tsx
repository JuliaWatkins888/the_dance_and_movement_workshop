import { useState } from 'react';
import { Box, Button, Input, RichTextEditor, Text } from '@inithium/ui';
import { useCreatePolicyItemMutation, useUpdatePolicyItemMutation } from '@inithium/api-client';
import type { PolicyItemDto } from '@inithium/api-client';

export interface PolicyItemEditDialogProps {
  readonly mode: 'create' | 'edit';
  readonly categoryId: string;
  readonly initialItem?: PolicyItemDto;
  readonly onDone: () => void;
}

// Tiptap's own empty-document HTML - what `content` looks like when nothing has been typed, used
// below as the "did the admin actually write anything" check.
const EMPTY_EDITOR_HTML = '<p></p>';

export const PolicyItemEditDialog = ({ mode, categoryId, initialItem, onDone }: PolicyItemEditDialogProps) => {
  const [createItem, { isLoading: isCreating }] = useCreatePolicyItemMutation();
  const [updateItem, { isLoading: isUpdating }] = useUpdatePolicyItemMutation();
  const isLoading = isCreating || isUpdating;
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const [title, setTitle] = useState(initialItem?.title ?? '');
  const [content, setContent] = useState(initialItem?.content ?? '');
  const [order, setOrder] = useState(String(initialItem?.order ?? 0));

  const handleSubmit = async () => {
    setSubmitError(undefined);

    if (!content || content === EMPTY_EDITOR_HTML) {
      setSubmitError('Content is required.');
      return;
    }

    const parsedOrder = Number(order);
    const input = {
      title,
      content,
      order: Number.isFinite(parsedOrder) ? parsedOrder : 0,
    };

    try {
      if (mode === 'create') {
        await createItem({ categoryId, ...input }).unwrap();
      } else if (initialItem) {
        await updateItem({ categoryId, itemId: initialItem.id, ...input }).unwrap();
      }
      onDone();
    } catch {
      setSubmitError('Could not save this item. Check the fields and try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Input label="Title" required value={title} onChange={(event) => setTitle(event.target.value)} />

      <RichTextEditor label="Content" required value={content} onChange={setContent} />

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
