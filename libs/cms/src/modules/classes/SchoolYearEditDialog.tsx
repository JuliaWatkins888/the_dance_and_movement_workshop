import { useState } from 'react';
import { Box, Button, IconButton, Input, Switch, Text } from '@inithium/ui';
import { readApiError, useCreateSchoolYearMutation, useUpdateSchoolYearMutation } from '@inithium/api-client';
import type { SchoolYearDto, SemesterWriteInput } from '@inithium/api-client';
import { FormError } from '../ecommerce/shared';
import { toDateInputValue } from './classAdmin.shared';

export interface SchoolYearEditDialogProps {
  readonly schoolYear?: SchoolYearDto;
  readonly onDone: () => void;
}

// Local key so rows keep their identity (and input focus) while semesters are added/removed.
type SemesterDraft = SemesterWriteInput & { key: string };

const nextDraftKey = (): string => crypto.randomUUID();

const emptySemester = (index: number): SemesterDraft => ({ key: nextDraftKey(), name: `Semester ${index + 1}`, startDate: '', endDate: '' });

export const SchoolYearEditDialog = ({ schoolYear, onDone }: SchoolYearEditDialogProps) => {
  const [createSchoolYear, { isLoading: isCreating }] = useCreateSchoolYearMutation();
  const [updateSchoolYear, { isLoading: isUpdating }] = useUpdateSchoolYearMutation();
  const isSaving = isCreating || isUpdating;
  const [error, setError] = useState<string | undefined>(undefined);

  const [name, setName] = useState(schoolYear?.name ?? '');
  const [registrationOpensAt, setRegistrationOpensAt] = useState(toDateInputValue(schoolYear?.registrationOpensAt));
  const [isPublished, setIsPublished] = useState(schoolYear?.isPublished ?? true);
  const [semesters, setSemesters] = useState<SemesterDraft[]>(
    schoolYear
      ? schoolYear.semesters.map((semester) => ({
          key: nextDraftKey(),
          id: semester.id,
          name: semester.name,
          startDate: toDateInputValue(semester.startDate),
          endDate: toDateInputValue(semester.endDate),
        }))
      : [emptySemester(0), emptySemester(1)],
  );

  const updateSemester = (key: string, patch: Partial<SemesterWriteInput>) =>
    setSemesters((previous) => previous.map((semester) => (semester.key === key ? { ...semester, ...patch } : semester)));

  const handleSubmit = async () => {
    setError(undefined);
    if (!name.trim()) return setError('Name is required.');
    if (semesters.length === 0) return setError('Add at least one semester.');
    if (semesters.some((semester) => !semester.name.trim() || !semester.startDate || !semester.endDate)) {
      return setError('Every semester needs a name, start date, and end date.');
    }
    if (semesters.some((semester) => semester.endDate < semester.startDate)) {
      return setError('A semester ends before it starts.');
    }

    const semesterInputs = semesters.map(({ key: _key, ...semester }) => ({ ...semester, name: semester.name.trim() }));

    try {
      if (schoolYear) {
        await updateSchoolYear({
          id: schoolYear.id,
          name: name.trim(),
          registrationOpensAt: registrationOpensAt || null,
          semesters: semesterInputs,
          isPublished,
        }).unwrap();
      } else {
        await createSchoolYear({
          name: name.trim(),
          ...(registrationOpensAt ? { registrationOpensAt } : {}),
          semesters: semesterInputs,
          isPublished,
        }).unwrap();
      }
      onDone();
    } catch (saveError) {
      setError(readApiError(saveError, 'Could not save this school year.').message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input label="Name" required placeholder="e.g. 2026–2027" value={name} onChange={(event) => setName(event.target.value)} className="flex-1" />
        <Input
          label="Registration Opens"
          type="date"
          value={registrationOpensAt}
          onChange={(event) => setRegistrationOpensAt(event.target.value)}
          className="flex-1"
        />
      </Box>

      <Box flex={{ direction: 'col', gap: 8 }}>
        <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
          Semesters
        </Text>
        <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          Every calendar month a semester touches is billed as a full month - these dates drive semester and full-year pricing.
        </Text>
        {semesters.map((semester) => (
          <Box key={semester.key} flex={{ direction: 'row', align: 'end', gap: 8 }}>
            <Input label="Semester" value={semester.name} onChange={(event) => updateSemester(semester.key, { name: event.target.value })} className="flex-1" />
            <Input label="Starts" type="date" value={semester.startDate} onChange={(event) => updateSemester(semester.key, { startDate: event.target.value })} className="flex-1" />
            <Input label="Ends" type="date" value={semester.endDate} onChange={(event) => updateSemester(semester.key, { endDate: event.target.value })} className="flex-1" />
            <IconButton
              icon="Trash"
              label={`Remove ${semester.name || 'semester'}`}
              textColor={{ color: 'red', intensity: 600 }}
              onClick={() => setSemesters((previous) => previous.filter((candidate) => candidate.key !== semester.key))}
              className="mb-1"
            />
          </Box>
        ))}
        <Box>
          <Button
            variant={{ kind: 'outlined', color: 'primary' }}
            onClick={() => setSemesters((previous) => [...previous, emptySemester(previous.length)])}
          >
            Add Semester
          </Button>
        </Box>
      </Box>

      <Switch label="Published (its time slots can appear on the public Classes page)" checked={isPublished} onCheckedChange={setIsPublished} />
      <FormError message={error} />
      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onDone} disabled={isSaving}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};
