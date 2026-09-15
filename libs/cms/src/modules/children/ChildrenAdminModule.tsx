import { useEffect, useState } from 'react';
import { Box, Button, IconButton, ListRow, Pagination, SearchFilterBar, Text, dialog, useSelection } from '@inithium/ui';
import { useDeleteChildMutation, useListChildrenAdminQuery } from '@inithium/api-client';
import type { ChildSearchField } from '@inithium/db';
import type { ChildDto } from '@inithium/api-client';
import { ChildEditDialog } from './ChildEditDialog';
import { CHILD_GENDER_LABELS } from './childGenderLabels';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const DIALOG_WIDTH = 560;

const FIELD_OPTIONS: { value: ChildSearchField; label: string }[] = [
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
];

const fullNameOf = (child: ChildDto): string => (child.lastName ? `${child.firstName} ${child.lastName}` : child.firstName);

const parentNameOf = (child: ChildDto): string =>
  child.parentLastName ? `${child.parentFirstName} ${child.parentLastName}` : child.parentFirstName;

export const ChildrenAdminModule = () => {
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState<ChildSearchField>('firstName');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, searchField]);

  const { data, isLoading, refetch } = useListChildrenAdminQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    searchField,
  });
  const [deleteChild] = useDeleteChildMutation();
  const selection = useSelection();

  const openCreateDialog = () => {
    const id = dialog.show(
      () => (
        <ChildEditDialog
          mode="create"
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: 'New Child Account', width: DIALOG_WIDTH },
    );
  };

  const openEditDialog = (child: ChildDto) => {
    const id = dialog.show(
      () => (
        <ChildEditDialog
          mode="edit"
          initialChild={child}
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: `Edit "${fullNameOf(child)}"`, width: DIALOG_WIDTH },
    );
  };

  const handleDelete = async (child: ChildDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this child account?',
      description: `This permanently removes "${fullNameOf(child)}" from ${parentNameOf(child)}'s account. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await deleteChild(child.id).unwrap();
    refetch();
  };

  const handleBulkDelete = async () => {
    const confirmed = await dialog.confirm({
      title: `Delete ${selection.selectedCount} child accounts?`,
      description: 'This permanently removes every selected child account. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await Promise.all([...selection.selectedIds].map((id) => deleteChild(id).unwrap()));
    selection.clear();
    refetch();
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Child Accounts
        </Text>
        <Box flex={{ direction: 'row', align: 'center', gap: 12 }}>
          {selection.selectedCount >= 2 ? (
            <Button variant={{ kind: 'filled', color: 'red' }} onClick={handleBulkDelete}>
              Delete Selected ({selection.selectedCount})
            </Button>
          ) : null}
          <Button variant={{ kind: 'filled', color: 'primary' }} onClick={openCreateDialog}>
            Add Child Account
          </Button>
        </Box>
      </Box>

      <SearchFilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchField={searchField}
        onSearchFieldChange={(value) => setSearchField(value as ChildSearchField)}
        fieldOptions={FIELD_OPTIONS}
        placeholder="Search by child's name..."
      />

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              Loading child accounts...
            </Text>
          </Box>
        ) : data && data.items.length > 0 ? (
          data.items.map((child) => (
            <ListRow
              key={child.id}
              selected={selection.isSelected(child.id)}
              onSelectedChange={() => selection.toggle(child.id)}
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
                Age {child.age} · {CHILD_GENDER_LABELS[child.gender]} · Parent: {parentNameOf(child)} ({child.parentEmail})
              </Text>
            </ListRow>
          ))
        ) : (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              No child accounts found.
            </Text>
          </Box>
        )}
      </Box>

      {data && data.totalPages > 1 ? <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};
