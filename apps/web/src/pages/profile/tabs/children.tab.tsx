import { Box, Button, IconButton, ListRow, Text, dialog } from '@inithium/ui';
import { useDeleteChildMutation, useListMyChildrenQuery } from '@inithium/api-client';
import type { ChildDto } from '@inithium/api-client';
import type { ProfileTabDescriptor, ProfileTabProps } from './registry';
import { ChildFormDialog } from './ChildFormDialog';
import { CHILD_GENDER_LABELS } from './childGenders';

const DIALOG_WIDTH = 480;

const fullNameOf = (child: ChildDto): string => (child.lastName ? `${child.firstName} ${child.lastName}` : child.firstName);

// Only ever mounted for the profile's own owner (visibility: 'owned' below) - a child account is
// private data about a minor, never shown to anyone viewing someone else's profile.
const ChildrenTab = (_props: ProfileTabProps) => {
  const { data: children, isLoading, refetch } = useListMyChildrenQuery();
  const [deleteChild] = useDeleteChildMutation();

  const openCreateDialog = () => {
    const id = dialog.show(
      () => (
        <ChildFormDialog
          mode="create"
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: 'Add Child Account', width: DIALOG_WIDTH },
    );
  };

  const openEditDialog = (child: ChildDto) => {
    const id = dialog.show(
      () => (
        <ChildFormDialog
          mode="edit"
          initialChild={child}
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: `Edit ${fullNameOf(child)}`, width: DIALOG_WIDTH },
    );
  };

  const handleDelete = async (child: ChildDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this child account?',
      description: `This permanently removes "${fullNameOf(child)}" from your account. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await deleteChild(child.id).unwrap();
    refetch();
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
        <Text as="p" className="text-sm text-surface-600">
          Add your children here so you can register them for classes.
        </Text>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={openCreateDialog}>
          Add Child
        </Button>
      </Box>

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <Box padding={{ base: 24 }}>
            <Text as="p" className="text-surface-500">
              Loading child accounts...
            </Text>
          </Box>
        ) : children && children.length > 0 ? (
          children.map((child) => (
            <ListRow
              key={child.id}
              trailing={
                <>
                  <IconButton icon="PencilSimple" label={`Edit ${fullNameOf(child)}`} onClick={() => openEditDialog(child)} />
                  <IconButton
                    icon="Trash"
                    label={`Delete ${fullNameOf(child)}`}
                    textColor={{ color: 'red', intensity: 600 }}
                    onClick={() => handleDelete(child)}
                  />
                </>
              }
            >
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
                {fullNameOf(child)}
              </Text>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                Age {child.age} · {CHILD_GENDER_LABELS[child.gender]}
              </Text>
            </ListRow>
          ))
        ) : (
          <Box padding={{ base: 24 }}>
            <Text as="p" className="text-surface-500">
              No child accounts yet.
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

const childrenTab: ProfileTabDescriptor = {
  id: 'child-accounts',
  label: 'Child Accounts',
  order: 10,
  visibility: 'owned',
  Component: ChildrenTab,
};

export default childrenTab;
