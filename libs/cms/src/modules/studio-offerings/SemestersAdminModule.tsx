import { useEffect, useState } from 'react';
import { alert, Box, Button, IconButton, ListRow, Pagination, Pill, SearchFilterBar, Text, dialog, useSelection } from '@inithium/ui';
import { useDeleteSemesterMutation, useListSemestersAdminQuery } from '@inithium/api-client';
import type { SemesterDto } from '@inithium/api-client';
import type { SemesterSearchField } from '@inithium/db';
import { SemesterEditDialog } from './SemesterEditDialog';
import { extractErrorMessage } from './extractErrorMessage';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const DIALOG_WIDTH = 560;

const FIELD_OPTIONS: { value: SemesterSearchField; label: string }[] = [{ value: 'name', label: 'Name' }];

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatSummary = (semester: SemesterDto): string =>
  `${dateFormatter.format(new Date(semester.startDate))} – ${dateFormatter.format(new Date(semester.endDate))}`;

const DELETE_BLOCKED_FALLBACK = 'Could not delete this semester. It may still have courses or workshops under it - remove those first.';

export const SemestersAdminModule = () => {
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState<SemesterSearchField>('name');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, searchField]);

  const { data, isLoading, refetch } = useListSemestersAdminQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    searchField,
  });
  const [deleteSemester] = useDeleteSemesterMutation();
  const selection = useSelection();

  const openCreateDialog = () => {
    const id = dialog.show(
      () => (
        <SemesterEditDialog
          mode="create"
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: 'New Semester', width: DIALOG_WIDTH },
    );
  };

  const openEditDialog = (semester: SemesterDto) => {
    const id = dialog.show(
      () => (
        <SemesterEditDialog
          mode="edit"
          initialSemester={semester}
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: `Edit "${semester.name}"`, width: DIALOG_WIDTH },
    );
  };

  const handleDelete = async (semester: SemesterDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this semester?',
      description: `This removes "${semester.name}" entirely. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;

    try {
      await deleteSemester(semester.id).unwrap();
      refetch();
    } catch (error) {
      alert.danger(extractErrorMessage(error, DELETE_BLOCKED_FALLBACK));
    }
  };

  const handleBulkDelete = async () => {
    const confirmed = await dialog.confirm({
      title: `Delete ${selection.selectedCount} semesters?`,
      description: 'This removes every selected semester entirely. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;

    const results = await Promise.allSettled([...selection.selectedIds].map((id) => deleteSemester(id).unwrap()));
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failures.length > 0) {
      alert.danger(`${failures.length} semester${failures.length === 1 ? '' : 's'} could not be deleted - they may still have courses or workshops under them.`);
    }
    selection.clear();
    refetch();
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Semesters
        </Text>
        <Box flex={{ direction: 'row', align: 'center', gap: 12 }}>
          {selection.selectedCount >= 2 ? (
            <Button variant={{ kind: 'filled', color: 'red' }} onClick={handleBulkDelete}>
              Delete Selected ({selection.selectedCount})
            </Button>
          ) : null}
          <Button variant={{ kind: 'filled', color: 'primary' }} onClick={openCreateDialog}>
            Add Semester
          </Button>
        </Box>
      </Box>

      <SearchFilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchField={searchField}
        onSearchFieldChange={(value) => setSearchField(value as SemesterSearchField)}
        fieldOptions={FIELD_OPTIONS}
        placeholder="Search by name..."
      />

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              Loading semesters...
            </Text>
          </Box>
        ) : data && data.items.length > 0 ? (
          data.items.map((semester) => (
            <ListRow
              key={semester.id}
              selected={selection.isSelected(semester.id)}
              onSelectedChange={() => selection.toggle(semester.id)}
              trailing={
                <>
                  {!semester.isPublished ? <Pill color={{ color: 'surface', intensity: 300 }}>Draft</Pill> : null}
                  <IconButton icon="PencilSimple" label={`Edit ${semester.name}`} onClick={() => openEditDialog(semester)} />
                  <IconButton
                    icon="Trash"
                    label={`Delete ${semester.name}`}
                    textColor={{ color: 'red', intensity: 600 }}
                    onClick={() => handleDelete(semester)}
                  />
                </>
              }
            >
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
                {semester.name}
              </Text>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                {formatSummary(semester)}
              </Text>
            </ListRow>
          ))
        ) : (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              No semesters found.
            </Text>
          </Box>
        )}
      </Box>

      {data && data.totalPages > 1 ? <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};
