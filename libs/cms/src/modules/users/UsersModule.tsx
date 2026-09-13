import { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  IconButton,
  ListRow,
  Pagination,
  SearchFilterBar,
  Text,
  dialog,
  resolveAvatarConfigProps,
  useSelection,
} from '@inithium/ui';
import { useDeleteUserMutation, useListUsersQuery } from '@inithium/api-client';
import type { AdminUser, UserSearchField } from '@inithium/api-client';
import { UserFormDialog } from './UserFormDialog';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const FIELD_OPTIONS: { value: UserSearchField; label: string }[] = [
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'email', label: 'Email' },
];

export const UsersModule = () => {
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState<UserSearchField>('email');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Small inline debounce - only one consumer of "search-as-you-type" exists today, so a shared
  // useDebounce hook would be guessing at a shape for a hypothetical second caller.
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, searchField]);

  const { data, isLoading, refetch } = useListUsersQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    searchField,
  });
  const [deleteUser] = useDeleteUserMutation();
  const selection = useSelection();

  // invalidatesTags/providesTags ('User') should trigger this automatically, but an explicit
  // refetch after each write is a reliable belt-and-suspenders fix regardless of any subtlety
  // in how the lazy-loaded CMS chunk's RTK Query cache reconciles with the main bundle's.
  const openCreateDialog = () => {
    const id = dialog.show(
      () => (
        <UserFormDialog
          mode="create"
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: 'Add User', width: 480 },
    );
  };

  const openEditDialog = (user: AdminUser) => {
    const id = dialog.show(
      () => (
        <UserFormDialog
          mode="edit"
          initialUser={user}
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: 'Edit User', width: 480 },
    );
  };

  const handleDelete = async (user: AdminUser) => {
    const confirmed = await dialog.confirm({
      title: 'Delete user?',
      description: `This will permanently delete ${user.email}. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await deleteUser(user.id).unwrap();
    refetch();
  };

  const handleBulkDelete = async () => {
    const confirmed = await dialog.confirm({
      title: `Delete ${selection.selectedCount} users?`,
      description: 'This will permanently delete every selected user. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await Promise.all([...selection.selectedIds].map((id) => deleteUser(id).unwrap()));
    selection.clear();
    refetch();
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
        <Text textColor={{ color: 'surface', intensity: 950 }} as="h1" className="text-2xl font-bold">
          Users
        </Text>
        <Box flex={{ direction: 'row', align: 'center', gap: 12 }}>
          {selection.selectedCount >= 2 ? (
            <Button variant={{ kind: 'filled', color: 'red' }} onClick={handleBulkDelete}>
              Delete Selected ({selection.selectedCount})
            </Button>
          ) : null}
          <Button variant={{ kind: 'filled', color: 'primary' }} onClick={openCreateDialog}>
            Add User
          </Button>
        </Box>
      </Box>

      <SearchFilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchField={searchField}
        onSearchFieldChange={(value) => setSearchField(value as UserSearchField)}
        fieldOptions={FIELD_OPTIONS}
        placeholder="Search users..."
      />

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <Box padding={{ base: 24 }}>
            <Text as="p" className="text-surface-500">
              Loading users...
            </Text>
          </Box>
        ) : data && data.items.length > 0 ? (
          data.items.map((user) => (
            <ListRow
              key={user.id}
              selected={selection.isSelected(user.id)}
              onSelectedChange={() => selection.toggle(user.id)}
              leading={
                <Avatar
                  {...resolveAvatarConfigProps(
                    user.avatar,
                    [user.firstName, user.lastName].filter(Boolean).join(' '),
                  )}
                  size={36}
                />
              }
              trailing={
                <>
                  <IconButton icon="PencilSimple" label={`Edit ${user.email}`} onClick={() => openEditDialog(user)} />
                  <IconButton
                    icon="Trash"
                    label={`Delete ${user.email}`}
                    textColor={{ color: 'red', intensity: 600 }}
                    onClick={() => handleDelete(user)}
                  />
                </>
              }
            >
              <Text textColor={{ color: 'surface', intensity: 950 }} as="span" className="font-medium">
                {[user.firstName, user.lastName].filter(Boolean).join(' ')}
              </Text>
              <Text as="span" className="text-sm text-surface-600">
                {user.email} · {user.role}
              </Text>
            </ListRow>
          ))
        ) : (
          <Box padding={{ base: 24 }}>
            <Text as="p" className="text-surface-500">
              No users found.
            </Text>
          </Box>
        )}
      </Box>

      {data && data.totalPages > 1 ? (
        <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
      ) : null}
    </Box>
  );
};
