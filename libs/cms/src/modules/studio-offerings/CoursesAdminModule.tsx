import { useEffect, useState } from 'react';
import { alert, Box, Button, IconButton, ListRow, Pagination, Pill, SearchFilterBar, Select, SelectItem, Text, dialog, useSelection } from '@inithium/ui';
import { useDeleteCourseMutation, useListAcademicYearsAdminQuery, useListCoursesAdminQuery } from '@inithium/api-client';
import type { CourseDto } from '@inithium/api-client';
import type { CourseSearchField } from '@inithium/db';
import { CourseEditDialog } from './CourseEditDialog';
import { extractErrorMessage } from './extractErrorMessage';
import { formatSemesterScope } from './formatOffering';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const DIALOG_WIDTH = 640;
const ALL_YEARS_VALUE = 'all';

const FIELD_OPTIONS: { value: CourseSearchField; label: string }[] = [{ value: 'name', label: 'Name' }];

const DELETE_BLOCKED_FALLBACK = 'Could not delete this course. It may still have classes under it - remove or move those first.';

export const CoursesAdminModule = () => {
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState<CourseSearchField>('name');
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
  const { data, isLoading, refetch } = useListCoursesAdminQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    searchField,
    academicYearId: academicYearFilter === ALL_YEARS_VALUE ? undefined : academicYearFilter,
  });
  const [deleteCourse] = useDeleteCourseMutation();
  const selection = useSelection();

  const openCreateDialog = () => {
    const id = dialog.show(
      () => (
        <CourseEditDialog
          mode="create"
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: 'New Course', width: DIALOG_WIDTH },
    );
  };

  const openEditDialog = (course: CourseDto) => {
    const id = dialog.show(
      () => (
        <CourseEditDialog
          mode="edit"
          initialCourse={course}
          onDone={() => {
            dialog.close(id);
            refetch();
          }}
        />
      ),
      { title: `Edit "${course.name}"`, width: DIALOG_WIDTH },
    );
  };

  const handleDelete = async (course: CourseDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this course?',
      description: `This removes "${course.name}" (${course.academicYearTitle}) entirely. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;

    try {
      await deleteCourse(course.id).unwrap();
      refetch();
    } catch (error) {
      alert.danger(extractErrorMessage(error, DELETE_BLOCKED_FALLBACK));
    }
  };

  const handleBulkDelete = async () => {
    const confirmed = await dialog.confirm({
      title: `Delete ${selection.selectedCount} courses?`,
      description: 'This removes every selected course entirely. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;

    const results = await Promise.allSettled([...selection.selectedIds].map((id) => deleteCourse(id).unwrap()));
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failures.length > 0) {
      alert.danger(`${failures.length} course${failures.length === 1 ? '' : 's'} could not be deleted - they may still have classes under them.`);
    }
    selection.clear();
    refetch();
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Courses
        </Text>
        <Box flex={{ direction: 'row', align: 'center', gap: 12 }}>
          {selection.selectedCount >= 2 ? (
            <Button variant={{ kind: 'filled', color: 'red' }} onClick={handleBulkDelete}>
              Delete Selected ({selection.selectedCount})
            </Button>
          ) : null}
          <Button variant={{ kind: 'filled', color: 'primary' }} onClick={openCreateDialog}>
            Add Course
          </Button>
        </Box>
      </Box>

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
          onSearchFieldChange={(value) => setSearchField(value as CourseSearchField)}
          fieldOptions={FIELD_OPTIONS}
          placeholder="Search by name..."
        />
      </Box>

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              Loading courses...
            </Text>
          </Box>
        ) : data && data.items.length > 0 ? (
          data.items.map((course) => (
            <ListRow
              key={course.id}
              selected={selection.isSelected(course.id)}
              onSelectedChange={() => selection.toggle(course.id)}
              trailing={
                <>
                  {!course.isPublished ? <Pill color={{ color: 'surface', intensity: 300 }}>Draft</Pill> : null}
                  <IconButton icon="PencilSimple" label={`Edit ${course.name}`} onClick={() => openEditDialog(course)} />
                  <IconButton
                    icon="Trash"
                    label={`Delete ${course.name}`}
                    textColor={{ color: 'red', intensity: 600 }}
                    onClick={() => handleDelete(course)}
                  />
                </>
              }
            >
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
                {course.name}
              </Text>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                {course.academicYearTitle} · {formatSemesterScope(course)} · {course.categories.join(', ')}
              </Text>
            </ListRow>
          ))
        ) : (
          <Box padding={{ base: 24 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              No courses found.
            </Text>
          </Box>
        )}
      </Box>

      {data && data.totalPages > 1 ? <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};
