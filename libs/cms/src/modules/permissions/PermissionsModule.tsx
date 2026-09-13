import { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  IconButton,
  ListRow,
  Pagination,
  SearchFilterBar,
  Text,
  dialog,
  resolveAvatarConfigProps,
} from '@inithium/ui';
import { useListUsersQuery } from '@inithium/api-client';
import type { AdminUser, UserSearchField } from '@inithium/api-client';
import { useCmsCurrentUser } from '../../CmsCurrentUserContext';
import { PermissionsEditDialog } from './PermissionsEditDialog';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const FIELD_OPTIONS: { value: UserSearchField; label: string }[] = [
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'email', label: 'Email' },
];

// Deliberately lists every account, not just non-'user' ones - hiding plain-user rows would make
// it impossible to grant a one-off capability override to someone who hasn't been given a role
// yet, a legitimate action. Plain-user rows are visually de-emphasized instead (muted text),
// keeping staff accounts visually prioritized without making anyone unreachable.
export const PermissionsModule = () => {
  const currentUser = useCmsCurrentUser();
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState<UserSearchField>('email');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

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

  const openEditDialog = (user: AdminUser) => {
    const id = dialog.show(
      () => (
        <PermissionsEditDialog
          user={user}
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: `Edit Permissions — ${user.email}`, width: 560 },
    );
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Text as="h1" className="text-2xl font-bold text-surface-950">
        Permissions
      </Text>

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
          data.items.map((user) => {
            const isPlainUser = user.role === 'user' && !user.isOwner;
            const isSelf = user.id === currentUser.id;
            return (
              <ListRow
                key={user.id}
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
                  <IconButton
                    icon="PencilSimple"
                    label={`Edit permissions for ${user.email}`}
                    disabled={isSelf}
                    onClick={() => openEditDialog(user)}
                  />
                }
              >
                <Text
                  as="span"
                  className={isPlainUser ? 'font-medium text-surface-500' : 'font-medium text-surface-950'}
                >
                  {[user.firstName, user.lastName].filter(Boolean).join(' ')}
                  {user.isOwner ? ' · Owner' : ''}
                </Text>
                <Text as="span" className="text-sm text-surface-600">
                  {user.email} · {user.role}
                  {isSelf ? ' (you)' : ''}
                </Text>
              </ListRow>
            );
          })
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
