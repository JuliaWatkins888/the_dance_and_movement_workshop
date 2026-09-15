import { useEffect, useState } from 'react';
import { Box, Button, IconButton, ListRow, Pagination, Pill, SearchFilterBar, Select, SelectItem, Text, dialog, useSelection } from '@inithium/ui';
import { useDeleteWorkshopMutation, useListSemestersAdminQuery, useListWorkshopsAdminQuery } from '@inithium/api-client';
import type { WorkshopDto } from '@inithium/api-client';
import type { WorkshopSearchField } from '@inithium/db';
import { WorkshopEditDialog } from './WorkshopEditDialog';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const DIALOG_WIDTH = 720;
const ALL_SEMESTERS_VALUE = 'all';

const FIELD_OPTIONS: { value: WorkshopSearchField; label: string }[] = [{ value: 'name', label: 'Name' }];

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

const formatSummary = (workshop: WorkshopDto): string => {
  const dates = workshop.occurrences.map((occurrence) => dateFormatter.format(new Date(occurrence.date))).join(', ');
  const price = `$${workshop.priceAmount}`;
  return `${dates || 'No dates set'} · ${price} · ${workshop.openings} open`;
};

export const WorkshopsAdminModule = () => {
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState<WorkshopSearchField>('name');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState(ALL_SEMESTERS_VALUE);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, searchField, semesterFilter]);

  const { data: semesterOptions } = useListSemestersAdminQuery({ page: 1, pageSize: 100 });
  const { data, isLoading, refetch } = useListWorkshopsAdminQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    searchField,
    semesterId: semesterFilter === ALL_SEMESTERS_VALUE ? undefined : semesterFilter,
  });
  const [deleteWorkshop] = useDeleteWorkshopMutation();
  const selection = useSelection();

  const openCreateDialog = () => {
    const id = dialog.show(
      () => (
        <WorkshopEditDialog
          mode="create"
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: 'New Workshop', width: DIALOG_WIDTH },
    );
  };

  const openEditDialog = (workshop: WorkshopDto) => {
    const id = dialog.show(
      () => (
        <WorkshopEditDialog
          mode="edit"
          initialWorkshop={workshop}
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: `Edit "${workshop.name}"`, width: DIALOG_WIDTH },
    );
  };

  const handleDelete = async (workshop: WorkshopDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this workshop?',
      description: `This removes "${workshop.name}" from the catalog. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await deleteWorkshop(workshop.id).unwrap();
    refetch();
  };

  const handleBulkDelete = async () => {
    const confirmed = await dialog.confirm({
      title: `Delete ${selection.selectedCount} workshops?`,
      description: 'This removes every selected workshop from the catalog. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await Promise.all([...selection.selectedIds].map((id) => deleteWorkshop(id).unwrap()));
    selection.clear();
    refetch();
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Workshops
        </Text>
        <Box flex={{ direction: 'row', align: 'center', gap: 12 }}>
          {selection.selectedCount >= 2 ? (
            <Button variant={{ kind: 'filled', color: 'red' }} onClick={handleBulkDelete}>
              Delete Selected ({selection.selectedCount})
            </Button>
          ) : null}
          <Button variant={{ kind: 'filled', color: 'primary' }} onClick={openCreateDialog}>
            Add Workshop
          </Button>
        </Box>
      </Box>

      <Box flex={{ direction: 'col', gap: 12 }}>
        <Select value={semesterFilter} onValueChange={setSemesterFilter} placeholder="Semester">
          <SelectItem value={ALL_SEMESTERS_VALUE}>All Semesters</SelectItem>
          {(semesterOptions?.items ?? []).map((semester) => (
            <SelectItem key={semester.id} value={semester.id}>
              {semester.name}
            </SelectItem>
          ))}
        </Select>

        <SearchFilterBar
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchField={searchField}
          onSearchFieldChange={(value) => setSearchField(value as WorkshopSearchField)}
          fieldOptions={FIELD_OPTIONS}
          placeholder="Search by name..."
        />
      </Box>

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              Loading workshops...
            </Text>
          </Box>
        ) : data && data.items.length > 0 ? (
          data.items.map((workshop) => (
            <ListRow
              key={workshop.id}
              selected={selection.isSelected(workshop.id)}
              onSelectedChange={() => selection.toggle(workshop.id)}
              trailing={
                <>
                  {!workshop.isPublished ? <Pill color={{ color: 'surface', intensity: 300 }}>Draft</Pill> : null}
                  <IconButton icon="PencilSimple" label={`Edit ${workshop.name}`} onClick={() => openEditDialog(workshop)} />
                  <IconButton
                    icon="Trash"
                    label={`Delete ${workshop.name}`}
                    textColor={{ color: 'red', intensity: 600 }}
                    onClick={() => handleDelete(workshop)}
                  />
                </>
              }
            >
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
                {workshop.name}
              </Text>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                {workshop.semesterName} · {formatSummary(workshop)}
              </Text>
            </ListRow>
          ))
        ) : (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              No workshops found.
            </Text>
          </Box>
        )}
      </Box>

      {data && data.totalPages > 1 ? <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};
