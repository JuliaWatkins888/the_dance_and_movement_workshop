import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, IconButton, ListRow, Pagination, SearchFilterBar, Text, dialog } from '@inithium/ui';
import { useDeleteContactMutation, useGetContactInboxQuery } from '@inithium/api-client';
import type { CommunicationDto } from '@inithium/api-client';
import type { CommunicationSearchField } from '@inithium/db';
import { CommunicationThreadDialogContent } from './CommunicationThreadDialogContent';
import { communicationNeedsReply } from './communicationNeedsReply';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const FIELD_OPTIONS: { value: CommunicationSearchField; label: string }[] = [
  { value: 'subject', label: 'Subject' },
  { value: 'email', label: 'Email' },
  { value: 'firstName', label: 'First name' },
  { value: 'lastName', label: 'Last name' },
];

export const CommunicationsAdminModule = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState<CommunicationSearchField>('subject');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, searchField]);

  const { data, isLoading, refetch } = useGetContactInboxQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    searchField,
  });
  const [deleteContact] = useDeleteContactMutation();

  const openThread = (communicationId: string, title: string) => {
    dialog.show(() => <CommunicationThreadDialogContent communicationId={communicationId} onReplySent={refetch} />, {
      title,
      width: 600,
    });
  };

  // Permanent - the server also deletes every notification this thread ever generated (both the
  // submitter's and the recipient's), so this is genuinely gone for everyone involved, not just
  // hidden from the admin list.
  const handleDelete = async (communication: CommunicationDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this conversation?',
      description: `This permanently deletes "${communication.subject}" from ${communication.firstName} ${communication.lastName}, along with their notification about it. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await deleteContact(communication.id).unwrap();
    refetch();
  };

  // Arriving from a 'contact:message-received' notification click - CmsNavbar's own
  // onNotificationClick just navigates to actionUrl, which is "/cms/communications?threadId=<id>".
  // Auto-opens that thread once, then strips the param so a page refresh doesn't reopen it.
  useEffect(() => {
    const threadId = searchParams.get('threadId');
    if (!threadId) return;

    openThread(threadId, 'Message');
    setSearchParams(
      (params) => {
        params.delete('threadId');
        return params;
      },
      { replace: true },
    );
    // Intentionally run once on mount only - re-running on every searchParams/refetch identity
    // change would reopen the dialog after the param has already been stripped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Text as="h1" className="text-2xl font-bold text-surface-950">
        Communications
      </Text>

      <SearchFilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchField={searchField}
        onSearchFieldChange={(value) => setSearchField(value as CommunicationSearchField)}
        fieldOptions={FIELD_OPTIONS}
        placeholder="Search messages..."
      />

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <Box padding={{ base: 24 }}>
            <Text as="p" className="text-surface-500">
              Loading messages...
            </Text>
          </Box>
        ) : data && data.items.length > 0 ? (
          data.items.map((communication) => (
            <ListRow
              key={communication.id}
              trailing={
                <>
                  <Button variant={{ kind: 'ghost', color: 'primary' }} onClick={() => openThread(communication.id, communication.subject)}>
                    View
                  </Button>
                  <IconButton
                    icon="Trash"
                    label={`Delete conversation: ${communication.subject}`}
                    textColor={{ color: 'red', intensity: 600 }}
                    onClick={() => handleDelete(communication)}
                  />
                </>
              }
            >
              <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
                <Text as="span" className="font-medium text-surface-950">
                  {communication.subject}
                </Text>
                {communicationNeedsReply(communication) ? (
                  <Text as="span" className="shrink-0 text-xs font-semibold text-accent-600">
                    Needs reply
                  </Text>
                ) : null}
              </Box>
              <Text as="span" className="text-sm text-surface-600">
                {communication.firstName} {communication.lastName} · {communication.email} · {communication.messages.length}{' '}
                message{communication.messages.length === 1 ? '' : 's'}
              </Text>
            </ListRow>
          ))
        ) : (
          <Box padding={{ base: 24 }}>
            <Text as="p" className="text-surface-500">
              No messages found.
            </Text>
          </Box>
        )}
      </Box>

      {data && data.totalPages > 1 ? <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};
