import { useState } from 'react';
import { Box, Button, Input, Switch, Text } from '@inithium/ui';
import { useCreateSemesterMutation, useUpdateSemesterMutation } from '@inithium/api-client';
import type { SemesterDto, SemesterWriteInput } from '@inithium/api-client';

export interface SemesterEditDialogProps {
  readonly mode: 'create' | 'edit';
  readonly initialSemester?: SemesterDto;
  readonly onDone: () => void;
}

const toDateInputValue = (iso?: string): string => (iso ? iso.slice(0, 10) : '');

export const SemesterEditDialog = ({ mode, initialSemester, onDone }: SemesterEditDialogProps) => {
  const [createSemester, { isLoading: isCreating }] = useCreateSemesterMutation();
  const [updateSemester, { isLoading: isUpdating }] = useUpdateSemesterMutation();
  const isLoading = isCreating || isUpdating;
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const [name, setName] = useState(initialSemester?.name ?? '');
  const [startDate, setStartDate] = useState(toDateInputValue(initialSemester?.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(initialSemester?.endDate));
  const [registrationOpensAt, setRegistrationOpensAt] = useState(toDateInputValue(initialSemester?.registrationOpensAt));
  const [isPublished, setIsPublished] = useState(initialSemester?.isPublished ?? true);

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

    const commonFields: SemesterWriteInput = {
      name: name.trim(),
      startDate,
      endDate,
      registrationOpensAt: registrationOpensAt || undefined,
      isPublished,
    };

    try {
      if (mode === 'create') {
        await createSemester(commonFields).unwrap();
      } else if (initialSemester) {
        await updateSemester({ id: initialSemester.id, ...commonFields }).unwrap();
      }
      onDone();
    } catch {
      setSubmitError('Could not save this semester. Check the fields and try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Input label="Semester Name" required placeholder="e.g. Fall 2026" value={name} onChange={(event) => setName(event.target.value)} />

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input label="Start Date" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} className="flex-1" />
        <Input label="End Date" type="date" required value={endDate} onChange={(event) => setEndDate(event.target.value)} className="flex-1" />
      </Box>

      <Input
        label="Registration Opens"
        type="date"
        helperText="Default registration-open date for Courses/Classes/Workshops under this semester - each can still override it individually."
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
