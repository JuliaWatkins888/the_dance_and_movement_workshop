import { useEffect, useState } from 'react';
import { alert, Box, Button, IconButton, ListRow, Pagination, Pill, SearchFilterBar, Text, dialog, useSelection } from '@inithium/ui';
import { useDeleteAcademicYearMutation, useListAcademicYearsAdminQuery } from '@inithium/api-client';
import type { AcademicYearDto } from '@inithium/api-client';
import type { AcademicYearSearchField } from '@inithium/db';
import { AcademicYearEditDialog } from './AcademicYearEditDialog';
import { extractErrorMessage } from './extractErrorMessage';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const DIALOG_WIDTH = 720;

const FIELD_OPTIONS: { value: AcademicYearSearchField; label: string }[] = [{ value: 'title', label: 'Title' }];

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatSummary = (academicYear: AcademicYearDto): string => {
  const span =
    academicYear.startDate && academicYear.endDate
      ? `${dateFormatter.format(new Date(academicYear.startDate))} – ${dateFormatter.format(new Date(academicYear.endDate))}`
      : 'No dates';
  return `${span} · ${academicYear.semesters.map((semester) => semester.name).join(' & ')}`;
};

const DELETE_BLOCKED_FALLBACK = 'Could not delete this academic year. It may still have courses or workshops under it - remove those first.';

export const AcademicYearsAdminModule = () => {
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState<AcademicYearSearchField>('title');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, searchField]);

  const { data, isLoading, refetch } = useListAcademicYearsAdminQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    searchField,
  });
  const [deleteAcademicYear] = useDeleteAcademicYearMutation();
  const selection = useSelection();

  const openCreateDialog = () => {
    const id = dialog.show(
      () => (
        <AcademicYearEditDialog
          mode="create"
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: 'New Academic Year', width: DIALOG_WIDTH },
    );
  };

  const openEditDialog = (academicYear: AcademicYearDto) => {
    const id = dialog.show(
      () => (
        <AcademicYearEditDialog
          mode="edit"
          initialAcademicYear={academicYear}
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: `Edit "${academicYear.title}"`, width: DIALOG_WIDTH },
    );
  };

  const handleDelete = async (academicYear: AcademicYearDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this academic year?',
      description: `This removes "${academicYear.title}" and its two semesters entirely. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;

    try {
      await deleteAcademicYear(academicYear.id).unwrap();
      refetch();
    } catch (error) {
      alert.danger(extractErrorMessage(error, DELETE_BLOCKED_FALLBACK));
    }
  };

  const handleBulkDelete = async () => {
    const confirmed = await dialog.confirm({
      title: `Delete ${selection.selectedCount} academic years?`,
      description: 'This removes every selected academic year and its semesters entirely. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;

    const results = await Promise.allSettled([...selection.selectedIds].map((id) => deleteAcademicYear(id).unwrap()));
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failures.length > 0) {
      alert.danger(`${failures.length} academic year${failures.length === 1 ? '' : 's'} could not be deleted - they may still have courses or workshops under them.`);
    }
    selection.clear();
    refetch();
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Academic Years
        </Text>
        <Box flex={{ direction: 'row', align: 'center', gap: 12 }}>
          {selection.selectedCount >= 2 ? (
            <Button variant={{ kind: 'filled', color: 'red' }} onClick={handleBulkDelete}>
              Delete Selected ({selection.selectedCount})
            </Button>
          ) : null}
          <Button variant={{ kind: 'filled', color: 'primary' }} onClick={openCreateDialog}>
            Add Academic Year
          </Button>
        </Box>
      </Box>

      <SearchFilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchField={searchField}
        onSearchFieldChange={(value) => setSearchField(value as AcademicYearSearchField)}
        fieldOptions={FIELD_OPTIONS}
        placeholder="Search by title..."
      />

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              Loading academic years...
            </Text>
          </Box>
        ) : data && data.items.length > 0 ? (
          data.items.map((academicYear) => (
            <ListRow
              key={academicYear.id}
              selected={selection.isSelected(academicYear.id)}
              onSelectedChange={() => selection.toggle(academicYear.id)}
              trailing={
                <>
                  {!academicYear.isPublished ? <Pill color={{ color: 'surface', intensity: 300 }}>Draft</Pill> : null}
                  <IconButton icon="PencilSimple" label={`Edit ${academicYear.title}`} onClick={() => openEditDialog(academicYear)} />
                  <IconButton
                    icon="Trash"
                    label={`Delete ${academicYear.title}`}
                    textColor={{ color: 'red', intensity: 600 }}
                    onClick={() => handleDelete(academicYear)}
                  />
                </>
              }
            >
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
                {academicYear.title}
              </Text>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                {formatSummary(academicYear)}
              </Text>
            </ListRow>
          ))
        ) : (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              No academic years found.
            </Text>
          </Box>
        )}
      </Box>

      {data && data.totalPages > 1 ? <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};
