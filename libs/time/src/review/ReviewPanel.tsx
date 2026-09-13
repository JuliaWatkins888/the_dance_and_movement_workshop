import { useMemo, useState } from 'react';
import { Box, Button, Icon, Pill, Select, SelectItem, Text, dialog, resolveContrastColor } from '@inithium/ui';
import {
  useGetAllTimeEntriesAdminQuery,
  useGetTimeEmployeesQuery,
  useGetTimeEntriesAdminQuery,
  useGetTimeEntryTypesQuery,
  useGetTimeSettingsQuery,
  useGetTimeSummaryAdminQuery,
} from '@inithium/api-client';
import type { TimeEmployeeDto, TimeEntryDto } from '@inithium/api-client';
import { MonthCalendarGrid } from './MonthCalendarGrid';
import { EntryEditDialog } from './EntryEditDialog';
import { TotalsByTypeSummary } from '../shared/TotalsByTypeSummary';
import { computeEntryTotalsByType } from '../shared/computeEntryTotals';
import { buildEmployeeColorMap } from './employeeColors';
import { formatMonthLabel, getCurrentZonedMonthAnchor, getMonthRangeUtc, shiftMonthAnchor } from '../timeDateUtils';
import { useTimeCurrentUser } from '../TimeCurrentUserContext';

const ALL_EMPLOYEES_VALUE = '__all__';

const employeeLabel = (employee: TimeEmployeeDto): string =>
  `${employee.firstName} ${employee.lastName ?? ''}${employee.isOwner ? ' (Owner)' : ''}`.trim();

export const ReviewPanel = () => {
  // Safe here (unlike inside EntryEditDialog itself) - ReviewPanel is a real descendant of
  // TimeCurrentUserProvider, not rendered through dialog.show()/DialogContainer's portal.
  const currentUser = useTimeCurrentUser();
  const { data: settings } = useGetTimeSettingsQuery();
  const { data: types = [] } = useGetTimeEntryTypesQuery();
  const { data: employees = [], isLoading: employeesLoading } = useGetTimeEmployeesQuery();

  const timeZone = settings?.timezone ?? 'America/New_York';
  const [monthAnchor, setMonthAnchor] = useState(() => getCurrentZonedMonthAnchor(timeZone));
  // undefined = default to the first real employee, not "All" - the single-employee view stays
  // the default per the product decision here, with "All Employees" as an opt-in switcher entry.
  const [selectedValue, setSelectedValue] = useState<string | undefined>(undefined);

  const isAllMode = selectedValue === ALL_EMPLOYEES_VALUE;
  const employeeId = !isAllMode ? (selectedValue ?? employees[0]?.id) : undefined;
  const range = getMonthRangeUtc(timeZone, monthAnchor);

  const { data: singleEntries = [] } = useGetTimeEntriesAdminQuery({ userId: employeeId ?? '', ...range }, { skip: !employeeId || isAllMode });
  const { data: singleTotals = [] } = useGetTimeSummaryAdminQuery({ userId: employeeId ?? '', ...range }, { skip: !employeeId || isAllMode });
  const { data: allEntries = [] } = useGetAllTimeEntriesAdminQuery(range, { skip: !isAllMode });

  const entries = isAllMode ? allEntries : singleEntries;
  const totals = isAllMode ? computeEntryTotalsByType(allEntries) : singleTotals;

  const employeeColorMap = useMemo(() => buildEmployeeColorMap(employees.map((employee) => employee.id)), [employees]);
  const getEntryColor = isAllMode ? (entry: TimeEntryDto) => employeeColorMap.get(entry.userId) ?? { color: 'primary', intensity: 500 } : undefined;

  // In "All Employees" mode there's no single "current" employee to default the create dialog
  // to - the dialog's own employee dropdown (see EntryEditDialog) lets the admin pick whichever
  // one they mean, defaulting to the first in the list.
  const createDialogEmployeeId = employeeId ?? employees[0]?.id;

  const openCreateDialog = (dateKey: string) => {
    if (!createDialogEmployeeId) return;
    const dialogId = dialog.show(
      () => (
        <EntryEditDialog
          mode="create"
          employeeId={createDialogEmployeeId}
          employees={employees}
          types={types}
          timeZone={timeZone}
          defaultDateKey={dateKey}
          onDone={() => dialog.close(dialogId)}
        />
      ),
      { title: 'New Time Entry', width: 640 },
    );
  };

  const openEditDialog = (entry: TimeEntryDto) => {
    const dialogId = dialog.show(
      () => (
        <EntryEditDialog
          mode="edit"
          employeeId={entry.userId}
          types={types}
          timeZone={timeZone}
          entry={entry}
          isOwner={currentUser.isOwner}
          onDone={() => dialog.close(dialogId)}
        />
      ),
      { title: 'Edit Time Entry', width: 640 },
    );
  };

  if (employeesLoading) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
        Loading employees...
      </Text>
    );
  }

  if (employees.length === 0) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
        No employees to review yet.
      </Text>
    );
  }

  return (
    <Box flex={{ direction: 'col', gap: 24 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }} className="flex-wrap">
        <Select value={selectedValue ?? employees[0]?.id} onValueChange={setSelectedValue} className="w-64">
          <SelectItem value={ALL_EMPLOYEES_VALUE}>All Employees</SelectItem>
          {employees.map((employee) => (
            <SelectItem key={employee.id} value={employee.id}>
              {employeeLabel(employee)}
            </SelectItem>
          ))}
        </Select>

        <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
          <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={() => setMonthAnchor((prev) => shiftMonthAnchor(prev, -1))}>
            <Icon as="span" name="CaretLeft" size={16} />
          </Button>
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="min-w-36 text-center font-medium">
            {formatMonthLabel(monthAnchor)}
          </Text>
          <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={() => setMonthAnchor((prev) => shiftMonthAnchor(prev, 1))}>
            <Icon as="span" name="CaretRight" size={16} />
          </Button>
        </Box>
      </Box>

      {isAllMode ? (
        <Box flex={{ direction: 'row', gap: 8 }} className="flex-wrap">
          {employees.map((employee) => {
            const color = employeeColorMap.get(employee.id) ?? { color: 'primary', intensity: 500 };
            return (
              <Pill key={employee.id} color={color}>
                <Text as="span" textColor={resolveContrastColor(color)} className="text-xs font-medium">
                  {employeeLabel(employee)}
                </Text>
              </Pill>
            );
          })}
        </Box>
      ) : null}

      <TotalsByTypeSummary totals={totals} types={types} title={isAllMode ? 'Team Totals' : 'Employee Totals'} />

      <MonthCalendarGrid
        monthAnchor={monthAnchor}
        entries={entries}
        types={types}
        timeZone={timeZone}
        onDayClick={openCreateDialog}
        onEntryClick={openEditDialog}
        getEntryColor={getEntryColor}
      />
    </Box>
  );
};
