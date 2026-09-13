import { useState } from 'react';
import { Box, Button, IconButton, Input, Text, alert, dialog } from '@inithium/ui';
import {
  useCreateTimeEntryTypeMutation,
  useDeleteTimeEntryTypeMutation,
  useGetTimeEntryTypesQuery,
  useUpdateTimeEntryTypeMutation,
} from '@inithium/api-client';

// Lives entirely inside /time, not the CMS - this plugin must work identically whether or not
// CMS is installed, so admins configure entry types here rather than through a CMS settings
// module. Server-driven 409s ("in use" / "last remaining type") are surfaced via toast rather
// than duplicated client-side, since the server is the single source of truth for both rules.
export const EntryTypesManager = () => {
  const { data: types = [], isLoading } = useGetTimeEntryTypesQuery();
  const [createType, { isLoading: isCreating }] = useCreateTimeEntryTypeMutation();
  const [updateType] = useUpdateTimeEntryTypeMutation();
  const [deleteType] = useDeleteTimeEntryTypeMutation();
  const [newLabel, setNewLabel] = useState('');

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return;
    try {
      await createType({ label, order: types.length }).unwrap();
      setNewLabel('');
    } catch {
      alert.danger('Could not create this type - it may already exist.');
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const current = types[index];
    const target = types[index + direction];
    if (!current || !target) return;
    await Promise.all([
      updateType({ id: current.id, order: target.order }).unwrap(),
      updateType({ id: target.id, order: current.order }).unwrap(),
    ]);
  };

  const handleDelete = async (id: string, label: string) => {
    const confirmed = await dialog.confirm({
      title: `Delete "${label}"?`,
      description: 'A type still used by existing time entries, or the last remaining type, cannot be deleted.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    try {
      await deleteType(id).unwrap();
    } catch {
      alert.danger('This type could not be deleted - it may be in use, or it may be the only type left.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 12 }}>
      <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
        Time Entry Types
      </Text>

      {isLoading ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
          Loading…
        </Text>
      ) : (
        <Box flex={{ direction: 'col', gap: 4 }}>
          {types.map((type, index) => (
            <Box
              key={type.id}
              flex={{ direction: 'row', align: 'center', justify: 'between', gap: 8 }}
              padding={{ base: 8 }}
              borderColor={{ color: 'surface', intensity: 200 }}
              className="rounded border"
            >
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm">
                {type.label}
              </Text>
              <Box flex={{ direction: 'row', gap: 4 }}>
                <IconButton icon="ArrowUp" label="Move up" disabled={index === 0} onClick={() => handleMove(index, -1)} />
                <IconButton
                  icon="ArrowDown"
                  label="Move down"
                  disabled={index === types.length - 1}
                  onClick={() => handleMove(index, 1)}
                />
                <IconButton
                  icon="Trash"
                  label={`Delete ${type.label}`}
                  textColor={{ color: 'red', intensity: 600 }}
                  onClick={() => handleDelete(type.id, type.label)}
                />
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <Box flex={{ direction: 'row', gap: 8 }}>
        <Input placeholder="New type name" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} className="flex-1" />
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleAdd} disabled={isCreating || !newLabel.trim()}>
          Add
        </Button>
      </Box>
    </Box>
  );
};
