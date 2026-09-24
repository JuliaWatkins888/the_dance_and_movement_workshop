import { useEffect, useState } from 'react';
import { Box, IconButton, ListRow, Pagination, Pill, SearchFilterBar, Select, SelectItem, Text, dialog } from '@inithium/ui';
import { useListAcademicYearsAdminQuery, useListSemestersAdminQuery } from '@inithium/api-client';
import type { SemesterDto } from '@inithium/api-client';
import type { SemesterSearchField } from '@inithium/db';
import { SemesterEditDialog } from './SemesterEditDialog';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const DIALOG_WIDTH = 560;
const ALL_YEARS_VALUE = 'all';

const FIELD_OPTIONS: { value: SemesterSearchField; label: string }[] = [{ value: 'name', label: 'Name' }];

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatSummary = (semester: SemesterDto): string =>
  `${semester.academicYearTitle ? `${semester.academicYearTitle} · ` : ''}${dateFormatter.format(new Date(semester.startDate))} – ${dateFormatter.format(new Date(semester.endDate))}`;

// Edit-only by design: semesters are created in pairs when an academic year is, and removed with it,
// so there's no Add or Delete here (see academic-years.route.ts).
export const SemestersAdminModule = () => {
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState<SemesterSearchField>('name');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [academicYearFilter, setAcademicYearFilter] = useState(ALL_YEARS_VALUE);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, searchField, academicYearFilter]);

  const { data: academicYearOptions } = useListAcademicYearsAdminQuery({ page: 1, pageSize: 100 });
  const { data, isLoading, refetch } = useListSemestersAdminQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    searchField,
    academicYearId: academicYearFilter === ALL_YEARS_VALUE ? undefined : academicYearFilter,
  });

  const openEditDialog = (semester: SemesterDto) => {
    const id = dialog.show(
      () => (
        <SemesterEditDialog
          semester={semester}
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: `Edit "${semester.name}"`, width: DIALOG_WIDTH },
    );
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
        Semesters
      </Text>

      <Box flex={{ direction: 'col', gap: 12 }}>
        <Select value={academicYearFilter} onValueChange={setAcademicYearFilter} placeholder="Academic Year">
          <SelectItem value={ALL_YEARS_VALUE}>All Academic Years</SelectItem>
          {(academicYearOptions?.items ?? []).map((academicYear) => (
            <SelectItem key={academicYear.id} value={academicYear.id}>
              {academicYear.title}
            </SelectItem>
          ))}
        </Select>

        <SearchFilterBar
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchField={searchField}
          onSearchFieldChange={(value) => setSearchField(value as SemesterSearchField)}
          fieldOptions={FIELD_OPTIONS}
          placeholder="Search by name..."
        />
      </Box>

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
              trailing={
                <>
                  {!semester.isPublished ? <Pill color={{ color: 'surface', intensity: 300 }}>Draft</Pill> : null}
                  <IconButton icon="PencilSimple" label={`Edit ${semester.name}`} onClick={() => openEditDialog(semester)} />
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
              No semesters found. Semesters are created together with an academic year.
            </Text>
          </Box>
        )}
      </Box>

      {data && data.totalPages > 1 ? <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};
