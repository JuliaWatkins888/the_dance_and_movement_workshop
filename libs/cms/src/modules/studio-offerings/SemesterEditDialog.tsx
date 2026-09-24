import { useState } from 'react';
import { Box, Button, Input, Switch, Text } from '@inithium/ui';
import { useUpdateSemesterMutation } from '@inithium/api-client';
import type { SemesterDto, SemesterWriteInput } from '@inithium/api-client';

export interface SemesterEditDialogProps {
  readonly semester: SemesterDto;
  readonly onDone: () => void;
}

const toDateInputValue = (iso?: string): string => (iso ? iso.slice(0, 10) : '');

// Edit-only: a semester is created together with its academic year and its parent year/term slot
// never change, so the year is shown here read-only for context rather than as a field.
export const SemesterEditDialog = ({ semester, onDone }: SemesterEditDialogProps) => {
  const [updateSemester, { isLoading }] = useUpdateSemesterMutation();
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const [name, setName] = useState(semester.name);
  const [startDate, setStartDate] = useState(toDateInputValue(semester.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(semester.endDate));
  const [registrationOpensAt, setRegistrationOpensAt] = useState(toDateInputValue(semester.registrationOpensAt));
  const [isPublished, setIsPublished] = useState(semester.isPublished);

  const handleSubmit = async () => {
    setSubmitError(undefined);

    if (!name.trim()) {
      setSubmitError('Name is required.');
      return;
    }
    if (!startDate || !endDate) {
      setSubmitError('Start and end dates are required.');
      return;
    }
    if (endDate < startDate) {
      setSubmitError('The end date must be on or after the start date.');
      return;
    }

    const fields: SemesterWriteInput = {
      name: name.trim(),
      startDate,
      endDate,
      registrationOpensAt: registrationOpensAt || undefined,
      isPublished,
    };

    try {
      await updateSemester({ id: semester.id, ...fields }).unwrap();
      onDone();
    } catch {
      setSubmitError('Could not save this semester. Check the fields and try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      {semester.academicYearTitle ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
          Part of academic year <strong>{semester.academicYearTitle}</strong>.
        </Text>
      ) : null}

      <Input label="Semester Name" required placeholder="e.g. Summer/Fall 2026" value={name} onChange={(event) => setName(event.target.value)} />

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input label="Start Date" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} className="flex-1" />
        <Input label="End Date" type="date" required value={endDate} onChange={(event) => setEndDate(event.target.value)} className="flex-1" />
      </Box>

      <Input
        label="Registration Opens"
        type="date"
        helperText="Default registration-open date for Classes/Workshops in this semester - each can still override it individually."
        value={registrationOpensAt}
        onChange={(event) => setRegistrationOpensAt(event.target.value)}
      />

      <Switch label="Published" checked={isPublished} onCheckedChange={setIsPublished} />

      {submitError ? (
        <Text as="p" textColor={{ color: 'red', intensity: 600 }} className="text-sm">
          {submitError}
        </Text>
      ) : null}

      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onDone} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};
