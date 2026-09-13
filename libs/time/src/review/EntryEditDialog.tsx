import { useState } from 'react';
import { Box, Button, Checkbox, Input, Select, SelectItem, Text, dialog } from '@inithium/ui';
import {
  useCreateTimeEntryAdminMutation,
  useDeleteTimeEntryAdminMutation,
  useLockTimeEntryMutation,
  useUnlockTimeEntryMutation,
  useUpdateTimeEntryAdminMutation,
} from '@inithium/api-client';
import type { TimeEmployeeDto, TimeEntryDto, TimeEntryTypeDto } from '@inithium/api-client';
import { EntryAuditHistoryPanel } from './EntryAuditHistoryPanel';
import { TimePicker } from '../shared/TimePicker';
import { addDaysToDateKey, zonedDateKey, zonedTimeOnlyValue } from '../timeDateUtils';

export interface EntryEditDialogProps {
  readonly mode: 'create' | 'edit';
  readonly employeeId: string;
  // Only needed for create mode's employee dropdown - lets an admin/owner log time on behalf of
  // any employee they can act on, not just whichever one Review currently has selected.
  readonly employees?: TimeEmployeeDto[];
  readonly types: TimeEntryTypeDto[];
  readonly timeZone: string;
  readonly defaultDateKey?: string;
  readonly entry?: TimeEntryDto;
  // Passed down explicitly rather than read via useTimeCurrentUser() here - dialog.show() renders
  // this component through DialogContainer, which is mounted as a sibling of TimeShell (outside
  // TimeCurrentUserProvider's subtree), not as its descendant. ReviewPanel (a real descendant)
  // reads the context once and hands the one value this dialog needs down as a plain prop.
  readonly isOwner?: boolean;
  readonly onDone: () => void;
}

const employeeLabel = (employee: TimeEmployeeDto): string =>
  `${employee.firstName} ${employee.lastName ?? ''}${employee.isOwner ? ' (Owner)' : ''}`.trim();

// This dialog is the only place a manual/backdated start or end time can ever be set - reachable
// only from ReviewPanel (time:manage), never from an employee's own My Time view. Date and time
// are picked separately (a single shared date plus two TimePickers) rather than one
// <input type="datetime-local"> per field - the old shape made picking an end time also force a
// day pick, which read as needless friction for the overwhelmingly common same-day case. An end
// time numerically before the start time is treated as the next calendar day (an overnight
// shift) rather than requiring a second date picker.
export const EntryEditDialog = ({ mode, employeeId, employees, types, timeZone, defaultDateKey, entry, isOwner = false, onDone }: EntryEditDialogProps) => {
  const [createEntry, { isLoading: isCreating }] = useCreateTimeEntryAdminMutation();
  const [updateEntry, { isLoading: isUpdating }] = useUpdateTimeEntryAdminMutation();
  const [deleteEntry, { isLoading: isDeleting }] = useDeleteTimeEntryAdminMutation();
  const [lockEntry, { isLoading: isLocking }] = useLockTimeEntryMutation();
  const [unlockEntry, { isLoading: isUnlocking }] = useUnlockTimeEntryMutation();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employeeId);
  const [typeId, setTypeId] = useState(entry?.typeId ?? types[0]?.id ?? '');
  const [date, setDate] = useState(entry ? zonedDateKey(entry.startAt, timeZone) : (defaultDateKey ?? ''));
  const [startTime, setStartTime] = useState(entry ? zonedTimeOnlyValue(entry.startAt, timeZone) : '09:00');
  const [endTime, setEndTime] = useState(entry?.endAt ? zonedTimeOnlyValue(entry.endAt, timeZone) : '17:00');
  const [stillClockedIn, setStillClockedIn] = useState(mode === 'edit' ? !entry?.endAt : false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const isLocked = entry?.locked ?? false;
  const isBusy = isCreating || isUpdating || isDeleting || isLocking || isUnlocking;
  // Can't un-close an entry that's already recorded a real end time through this dialog - there's
  // no "clear the end time" operation on the backend, only "set a new one". Only relevant when
  // editing an entry that's currently open (no endAt yet).
  const canToggleStillClockedIn = mode === 'create' || !entry?.endAt;

  const handleSubmit = async () => {
    setSubmitError(undefined);

    if (!date) {
      setSubmitError('A date is required.');
      return;
    }

    const startAt = `${date}T${startTime}`;
    const endAt = stillClockedIn ? undefined : `${endTime <= startTime ? addDaysToDateKey(date, 1) : date}T${endTime}`;

    try {
      if (mode === 'create') {
        await createEntry({ userId: selectedEmployeeId, typeId, startAt, endAt }).unwrap();
      } else if (entry) {
        await updateEntry({ id: entry.id, typeId, startAt, endAt }).unwrap();
      }
      onDone();
    } catch {
      setSubmitError('Could not save this entry. Check the times (they must not overlap another entry) and try again.');
    }
  };

  const handleDelete = async () => {
    if (!entry) return;
    const confirmed = await dialog.confirm({
      title: 'Delete this time entry?',
      description: 'This permanently removes it. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    await deleteEntry(entry.id).unwrap();
    onDone();
  };

  const handleToggleLock = async () => {
    if (!entry) return;
    if (isLocked) {
      await unlockEntry(entry.id).unwrap();
    } else {
      await lockEntry(entry.id).unwrap();
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      {isLocked ? (
        <Text as="p" textColor={{ color: 'amber', intensity: 700 }} className="text-sm">
          This entry is locked. {isOwner ? 'Unlock it below to make changes.' : 'Only the owner can unlock it.'}
        </Text>
      ) : null}

      <Box flex={{ direction: 'row', gap: 12 }} className="flex-wrap">
        {mode === 'create' && employees && employees.length > 0 ? (
          <Select label="Employee" value={selectedEmployeeId} onValueChange={setSelectedEmployeeId} disabled={isBusy} className="min-w-48 flex-1">
            {employees.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employeeLabel(employee)}
              </SelectItem>
            ))}
          </Select>
        ) : null}
        <Select label="Type" value={typeId} onValueChange={setTypeId} disabled={isBusy || isLocked} className="min-w-40 flex-1">
          {types.map((type) => (
            <SelectItem key={type.id} value={type.id}>
              {type.label}
            </SelectItem>
          ))}
        </Select>
      </Box>

      <Input label="Date" type="date" value={date} disabled={isBusy || isLocked} onChange={(event) => setDate(event.target.value)} />

      <Box flex={{ direction: 'row', gap: 24 }} className="flex-wrap">
        <TimePicker label="Start" value={startTime} onChange={setStartTime} disabled={isBusy || isLocked} />
        <TimePicker label="End" value={endTime} onChange={setEndTime} disabled={isBusy || isLocked || stillClockedIn} />
      </Box>

      <Checkbox
        label="Still clocked in (no end time)"
        checked={stillClockedIn}
        onCheckedChange={(checked) => setStillClockedIn(checked === true)}
        disabled={isBusy || isLocked || !canToggleStillClockedIn}
      />

      {submitError ? (
        <Text as="p" textColor={{ color: 'red', intensity: 600 }} className="text-sm">
          {submitError}
        </Text>
      ) : null}

      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 8 }} className="flex-wrap">
        <Box flex={{ direction: 'row', gap: 8 }}>
          {mode === 'edit' && entry ? (
            <Button variant={{ kind: 'ghost', color: 'red' }} onClick={handleDelete} disabled={isBusy}>
              Delete
            </Button>
          ) : null}
          {mode === 'edit' && isOwner ? (
            <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={handleToggleLock} disabled={isBusy}>
              {isLocked ? 'Unlock' : 'Lock'}
            </Button>
          ) : null}
        </Box>
        <Box flex={{ direction: 'row', gap: 8 }}>
          <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onDone} disabled={isBusy}>
            Cancel
          </Button>
          <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isBusy || isLocked}>
            {isBusy ? 'Saving…' : 'Save'}
          </Button>
        </Box>
      </Box>

      {mode === 'edit' && entry ? <EntryAuditHistoryPanel entryId={entry.id} timeZone={timeZone} /> : null}
    </Box>
  );
};
