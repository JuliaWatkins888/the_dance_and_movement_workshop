import { useEffect, useState } from 'react';
import { Box, Button, IconButton, ListRow, Pagination, Pill, SearchFilterBar, Select, SelectItem, Text, dialog, useSelection } from '@inithium/ui';
import { useDeleteClassMutation, useListAcademicYearsAdminQuery, useListClassesAdminQuery, useListCoursesAdminQuery } from '@inithium/api-client';
import type { ClassDto } from '@inithium/api-client';
import type { ClassSearchField } from '@inithium/db';
import { ClassEditDialog } from './ClassEditDialog';
import { formatCurrency, formatSemesterScope } from './formatOffering';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const DIALOG_WIDTH = 720;
const ALL_VALUE = 'all';

const FIELD_OPTIONS: { value: ClassSearchField; label: string }[] = [{ value: 'variantLabel', label: 'Variant Label' }];

const formatTime12h = (time: string): string => {
  const [hoursRaw, minutes] = time.split(':');
  const hours = Number(hoursRaw);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${minutes} ${period}`;
};

const termDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Two class records can share an identical variantLabel/day/time (e.g. one still carrying an old
// term's dates, one carrying the next term's) and read as duplicates in this list with nothing to
// tell them apart - the term range makes clear they're different offering windows.
const formatSummary = (classItem: ClassDto): string => {
  const days = classItem.daysOfWeek.join('/');
  const schedule = `${days} ${formatTime12h(classItem.startTime)}–${formatTime12h(classItem.endTime)}`;
  const price = `${formatCurrency(classItem.priceAmount)}/mo`;
  const term = `${termDateFormatter.format(new Date(classItem.startDate))} – ${termDateFormatter.format(new Date(classItem.endDate))}`;
  return `${classItem.courseName}${classItem.variantLabel ? ` · ${classItem.variantLabel}` : ''} · ${formatSemesterScope(classItem)} · ${schedule} · ${term} · ${price} · ${classItem.openings} open`;
};

export const ClassesAdminModule = () => {
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState<ClassSearchField>('variantLabel');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [academicYearFilter, setAcademicYearFilter] = useState(ALL_VALUE);
  const [courseFilter, setCourseFilter] = useState(ALL_VALUE);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, searchField, courseFilter]);

  useEffect(() => {
    setCourseFilter(ALL_VALUE);
  }, [academicYearFilter]);

  const { data: academicYearOptions } = useListAcademicYearsAdminQuery({ page: 1, pageSize: 100 });
  const { data: courseOptions } = useListCoursesAdminQuery({
    page: 1,
    pageSize: 100,
    academicYearId: academicYearFilter === ALL_VALUE ? undefined : academicYearFilter,
  });
  const { data, isLoading, refetch } = useListClassesAdminQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    searchField,
    courseId: courseFilter === ALL_VALUE ? undefined : courseFilter,
  });
  const [deleteClass] = useDeleteClassMutation();
  const selection = useSelection();

  const openCreateDialog = () => {
    const id = dialog.show(
      () => (
        <ClassEditDialog
          mode="create"
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: 'New Class', width: DIALOG_WIDTH },
    );
  };

  const openEditDialog = (classItem: ClassDto) => {
    const id = dialog.show(
      () => (
        <ClassEditDialog
          mode="edit"
          initialClass={classItem}
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: `Edit "${classItem.courseName}${classItem.variantLabel ? ` – ${classItem.variantLabel}` : ''}"`, width: DIALOG_WIDTH },
    );
  };

  const handleDelete = async (classItem: ClassDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this class?',
      description: `This removes "${classItem.courseName}${classItem.variantLabel ? ` – ${classItem.variantLabel}` : ''}" from the catalog. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await deleteClass(classItem.id).unwrap();
    refetch();
  };

  const handleBulkDelete = async () => {
    const confirmed = await dialog.confirm({
      title: `Delete ${selection.selectedCount} classes?`,
      description: 'This removes every selected class from the catalog. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await Promise.all([...selection.selectedIds].map((id) => deleteClass(id).unwrap()));
    selection.clear();
    refetch();
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Classes
        </Text>
        <Box flex={{ direction: 'row', align: 'center', gap: 12 }}>
          {selection.selectedCount >= 2 ? (
            <Button variant={{ kind: 'filled', color: 'red' }} onClick={handleBulkDelete}>
              Delete Selected ({selection.selectedCount})
            </Button>
          ) : null}
          <Button variant={{ kind: 'filled', color: 'primary' }} onClick={openCreateDialog}>
            Add Class
          </Button>
        </Box>
      </Box>

      <Box flex={{ direction: 'col', gap: 12 }}>
        <Box className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select value={academicYearFilter} onValueChange={setAcademicYearFilter} placeholder="Academic Year">
            <SelectItem value={ALL_VALUE}>All Academic Years</SelectItem>
            {(academicYearOptions?.items ?? []).map((academicYear) => (
              <SelectItem key={academicYear.id} value={academicYear.id}>
                {academicYear.title}
              </SelectItem>
            ))}
          </Select>

          <Select value={courseFilter} onValueChange={setCourseFilter} placeholder="Course">
            <SelectItem value={ALL_VALUE}>All Courses</SelectItem>
            {(courseOptions?.items ?? []).map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.name}
              </SelectItem>
            ))}
          </Select>
        </Box>

        <SearchFilterBar
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchField={searchField}
          onSearchFieldChange={(value) => setSearchField(value as ClassSearchField)}
          fieldOptions={FIELD_OPTIONS}
          placeholder="Search by variant label..."
        />
      </Box>

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              Loading classes...
            </Text>
          </Box>
        ) : data && data.items.length > 0 ? (
          data.items.map((classItem) => (
            <ListRow
              key={classItem.id}
              selected={selection.isSelected(classItem.id)}
              onSelectedChange={() => selection.toggle(classItem.id)}
              trailing={
                <>
                  {!classItem.isPublished ? <Pill color={{ color: 'surface', intensity: 300 }}>Draft</Pill> : null}
                  <IconButton icon="PencilSimple" label={`Edit ${classItem.courseName}`} onClick={() => openEditDialog(classItem)} />
                  <IconButton
                    icon="Trash"
                    label={`Delete ${classItem.courseName}`}
                    textColor={{ color: 'red', intensity: 600 }}
                    onClick={() => handleDelete(classItem)}
                  />
                </>
              }
            >
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
                {classItem.courseName}
                {classItem.variantLabel ? ` – ${classItem.variantLabel}` : ''}
              </Text>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                {formatSummary(classItem)}
              </Text>
            </ListRow>
          ))
        ) : (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              No classes found.
            </Text>
          </Box>
        )}
      </Box>

      {data && data.totalPages > 1 ? <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};
