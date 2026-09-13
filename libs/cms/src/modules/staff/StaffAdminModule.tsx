import { useEffect, useState } from 'react';
import { Avatar, Box, Button, IconButton, ListRow, Pagination, SearchFilterBar, Text, dialog, useSelection } from '@inithium/ui';
import { useDeleteStaffMemberMutation, useListStaffAdminQuery } from '@inithium/api-client';
import type { StaffSearchField } from '@inithium/db';
import type { StaffMemberDto } from '@inithium/api-client';
import { StaffEditDialog } from './StaffEditDialog';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const DIALOG_WIDTH = 640;

const FIELD_OPTIONS: { value: StaffSearchField; label: string }[] = [{ value: 'title', label: 'Title' }];

const fullNameOf = (member: StaffMemberDto): string =>
  member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName;

export const StaffAdminModule = () => {
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState<StaffSearchField>('title');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, searchField]);

  const { data, isLoading, refetch } = useListStaffAdminQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    searchField,
  });
  const [deleteStaffMember] = useDeleteStaffMemberMutation();
  const selection = useSelection();

  const openCreateDialog = () => {
    const id = dialog.show(
      () => (
        <StaffEditDialog
          mode="create"
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: 'New Staff Member', width: DIALOG_WIDTH },
    );
  };

  const openEditDialog = (member: StaffMemberDto) => {
    const id = dialog.show(
      () => (
        <StaffEditDialog
          mode="edit"
          initialStaff={member}
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: `Edit "${fullNameOf(member)}"`, width: DIALOG_WIDTH },
    );
  };

  const handleDelete = async (member: StaffMemberDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this staff member?',
      description: `This removes "${fullNameOf(member)}" from the staff directory. Their user account is not affected. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await deleteStaffMember(member.id).unwrap();
    refetch();
  };

  const handleBulkDelete = async () => {
    const confirmed = await dialog.confirm({
      title: `Delete ${selection.selectedCount} staff members?`,
      description: 'This removes every selected staff member from the directory. Their user accounts are not affected. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await Promise.all([...selection.selectedIds].map((id) => deleteStaffMember(id).unwrap()));
    selection.clear();
    refetch();
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Staff
        </Text>
        <Box flex={{ direction: 'row', align: 'center', gap: 12 }}>
          {selection.selectedCount >= 2 ? (
            <Button variant={{ kind: 'filled', color: 'red' }} onClick={handleBulkDelete}>
              Delete Selected ({selection.selectedCount})
            </Button>
          ) : null}
          <Button variant={{ kind: 'filled', color: 'primary' }} onClick={openCreateDialog}>
            Add Staff Member
          </Button>
        </Box>
      </Box>

      <SearchFilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchField={searchField}
        onSearchFieldChange={(value) => setSearchField(value as StaffSearchField)}
        fieldOptions={FIELD_OPTIONS}
        placeholder="Search by title..."
      />

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              Loading staff...
            </Text>
          </Box>
        ) : data && data.items.length > 0 ? (
          data.items.map((member) => (
            <ListRow
              key={member.id}
              selected={selection.isSelected(member.id)}
              onSelectedChange={() => selection.toggle(member.id)}
              leading={
                member.photoUrl ? (
                  <img src={member.photoUrl} alt="" className="h-12 w-12 rounded object-cover" />
                ) : (
                  <Avatar source={{ variant: 'initials', name: fullNameOf(member) }} size={48} />
                )
              }
              trailing={
                <>
                  <IconButton icon="PencilSimple" label={`Edit ${fullNameOf(member)}`} onClick={() => openEditDialog(member)} />
                  <IconButton
                    icon="Trash"
                    label={`Delete ${fullNameOf(member)}`}
                    textColor={{ color: 'red', intensity: 600 }}
                    onClick={() => handleDelete(member)}
                  />
                </>
              }
            >
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
                {fullNameOf(member)}
              </Text>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                {member.title} · {member.email}
              </Text>
            </ListRow>
          ))
        ) : (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              No staff members found.
            </Text>
          </Box>
        )}
      </Box>

      {data && data.totalPages > 1 ? <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};
