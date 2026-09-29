import { Box, Button, IconButton, ListRow, Pill, Text, alert, dialog } from '@inithium/ui';
import { readApiError, useDeleteSchoolYearMutation, useListSchoolYearsAdminQuery } from '@inithium/api-client';
import type { SchoolYearDto } from '@inithium/api-client';
import { EmptyState } from '../ecommerce/shared';
import { ALERT_POSITION, DIALOG_WIDTH, formatCalendarDate } from './classAdmin.shared';
import { SchoolYearEditDialog } from './SchoolYearEditDialog';

const describeSemesters = (schoolYear: SchoolYearDto): string =>
  schoolYear.semesters
    .map((semester) => `${semester.name}: ${formatCalendarDate(semester.startDate)} – ${formatCalendarDate(semester.endDate)}`)
    .join(' · ');

export const SchoolYearsTab = () => {
  const { data: schoolYears = [], isLoading } = useListSchoolYearsAdminQuery();
  const [deleteSchoolYear] = useDeleteSchoolYearMutation();

  const openDialog = (schoolYear?: SchoolYearDto) => {
    const id = dialog.show(() => <SchoolYearEditDialog schoolYear={schoolYear} onDone={() => dialog.close(id)} />, {
      title: schoolYear ? `Edit "${schoolYear.name}"` : 'New School Year',
      width: DIALOG_WIDTH,
    });
  };

  const handleDelete = async (schoolYear: SchoolYearDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this school year?',
      description: `This removes "${schoolYear.name}". It must have no time slots scheduled in it.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    try {
      await deleteSchoolYear(schoolYear.id).unwrap();
    } catch (error) {
      alert.danger(readApiError(error, 'Could not delete this school year.').message, { position: ALERT_POSITION });
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }} className="flex-wrap">
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="max-w-2xl text-sm">
          The calendar classes run on. Semester dates set each time slot’s dates and decide which payment plans are offered.
        </Text>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => openDialog()}>
          Add School Year
        </Button>
      </Box>

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <EmptyState message="Loading school years..." />
        ) : schoolYears.length === 0 ? (
          <EmptyState message="No school years yet." />
        ) : (
          schoolYears.map((schoolYear) => (
            <ListRow
              key={schoolYear.id}
              trailing={
                <>
                  {!schoolYear.isPublished ? (
                    <Pill color={{ color: 'surface', intensity: 300 }} className="text-surface-900">
                      Draft
                    </Pill>
                  ) : null}
                  <IconButton icon="PencilSimple" label={`Edit ${schoolYear.name}`} onClick={() => openDialog(schoolYear)} />
                  <IconButton
                    icon="Trash"
                    label={`Delete ${schoolYear.name}`}
                    textColor={{ color: 'red', intensity: 600 }}
                    onClick={() => handleDelete(schoolYear)}
                  />
                </>
              }
            >
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
                {schoolYear.name}
              </Text>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                {describeSemesters(schoolYear)}
                {schoolYear.registrationOpensAt ? ` · Registration opens ${formatCalendarDate(schoolYear.registrationOpensAt)}` : ''}
              </Text>
            </ListRow>
          ))
        )}
      </Box>
    </Box>
  );
};
