import { useState } from 'react';
import { Box, Button, Input, Switch, Text, Textarea } from '@inithium/ui';
import { useCreateAcademicYearMutation, useUpdateAcademicYearMutation } from '@inithium/api-client';
import type { AcademicYearDto } from '@inithium/api-client';
import type { SemesterTerm } from '@inithium/db';

export interface AcademicYearEditDialogProps {
  readonly mode: 'create' | 'edit';
  readonly initialAcademicYear?: AcademicYearDto;
  readonly onDone: () => void;
}

// Not imported at runtime from @inithium/db's own SEMESTER_TERM_LABELS (that package depends on
// mongoose) - see ClassEditDialog's identical ALL_DAYS precedent for why libs/cms, a Vite-bundled
// frontend package, only takes `import type` from @inithium/db.
const TERMS: readonly { readonly term: SemesterTerm; readonly label: string }[] = [
  { term: 'summer-fall', label: 'Summer/Fall' },
  { term: 'winter-spring', label: 'Winter/Spring' },
];

interface SemesterDatesState {
  startDate: string;
  endDate: string;
  registrationOpensAt: string;
}

const EMPTY_DATES: SemesterDatesState = { startDate: '', endDate: '', registrationOpensAt: '' };

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const toDatesInput = ({ startDate, endDate, registrationOpensAt }: SemesterDatesState) => ({
  startDate,
  endDate,
  registrationOpensAt: registrationOpensAt || undefined,
});

interface SemesterDatesFieldsProps {
  readonly label: string;
  readonly value: SemesterDatesState;
  readonly onChange: (next: SemesterDatesState) => void;
}

const SemesterDatesFields = ({ label, value, onChange }: SemesterDatesFieldsProps) => (
  <Box borderColor={{ color: 'surface', intensity: 300 }} padding={{ base: 12 }} flex={{ direction: 'col', gap: 12 }} className="rounded-md border">
    <Text as="h3" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-semibold">
      {label}
    </Text>
    <Box flex={{ direction: 'row', gap: 12 }}>
      <Input label="Start Date" type="date" required value={value.startDate} onChange={(event) => onChange({ ...value, startDate: event.target.value })} className="flex-1" />
      <Input label="End Date" type="date" required value={value.endDate} onChange={(event) => onChange({ ...value, endDate: event.target.value })} className="flex-1" />
      <Input
        label="Registration Opens"
        type="date"
        value={value.registrationOpensAt}
        onChange={(event) => onChange({ ...value, registrationOpensAt: event.target.value })}
        className="flex-1"
      />
    </Box>
  </Box>
);

// Create stands up the year's two semesters in one step, so it collects both date ranges. Edit only
// changes the year's own fields - a semester's dates/registration/published state live in the
// Semesters module (and a year's span is derived from them, never entered here).
export const AcademicYearEditDialog = ({ mode, initialAcademicYear, onDone }: AcademicYearEditDialogProps) => {
  const [createAcademicYear, { isLoading: isCreating }] = useCreateAcademicYearMutation();
  const [updateAcademicYear, { isLoading: isUpdating }] = useUpdateAcademicYearMutation();
  const isLoading = isCreating || isUpdating;
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const [title, setTitle] = useState(initialAcademicYear?.title ?? '');
  const [description, setDescription] = useState(initialAcademicYear?.description ?? '');
  const [isPublished, setIsPublished] = useState(initialAcademicYear?.isPublished ?? true);
  const [semesterDates, setSemesterDates] = useState<Record<SemesterTerm, SemesterDatesState>>({
    'summer-fall': EMPTY_DATES,
    'winter-spring': EMPTY_DATES,
  });

  const handleSubmit = async () => {
    setSubmitError(undefined);

    if (!title.trim()) {
      setSubmitError('Title is required.');
      return;
    }

    try {
      if (mode === 'create') {
        for (const { term, label } of TERMS) {
          const dates = semesterDates[term];
          if (!dates.startDate || !dates.endDate) {
            setSubmitError(`${label} needs a start and end date.`);
            return;
          }
          if (dates.endDate < dates.startDate) {
            setSubmitError(`${label} must end on or after its start date.`);
            return;
          }
        }

        await createAcademicYear({
          title: title.trim(),
          description: description.trim() || undefined,
          isPublished,
          semesters: {
            'summer-fall': toDatesInput(semesterDates['summer-fall']),
            'winter-spring': toDatesInput(semesterDates['winter-spring']),
          },
        }).unwrap();
      } else if (initialAcademicYear) {
        // Sent as-is (even when empty) so clearing the description actually clears it.
        await updateAcademicYear({ id: initialAcademicYear.id, title: title.trim(), description: description.trim(), isPublished }).unwrap();
      }
      onDone();
    } catch {
      setSubmitError('Could not save this academic year. Check the fields and try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Input label="Title" required placeholder="e.g. 2026–2027" value={title} onChange={(event) => setTitle(event.target.value)} />

      <Textarea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />

      {mode === 'create' ? (
        <Box flex={{ direction: 'col', gap: 12 }}>
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
            Every academic year is split into two semesters, created together with it. Set each one&apos;s dates now - you can adjust them (and their names) later under Semesters.
          </Text>
          {TERMS.map(({ term, label }) => (
            <SemesterDatesFields
              key={term}
              label={label}
              value={semesterDates[term]}
              onChange={(next) => setSemesterDates((current) => ({ ...current, [term]: next }))}
            />
          ))}
        </Box>
      ) : initialAcademicYear && initialAcademicYear.semesters.length > 0 ? (
        <Box flex={{ direction: 'col', gap: 4 }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
            Semesters
          </Text>
          {initialAcademicYear.semesters.map((semester) => (
            <Text key={semester.id} as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
              {semester.name}: {dateFormatter.format(new Date(semester.startDate))} – {dateFormatter.format(new Date(semester.endDate))}
            </Text>
          ))}
          <Text as="p" textColor={{ color: 'surface', intensity: 500 }} className="text-xs">
            Edit semester dates, registration and visibility under Semesters.
          </Text>
        </Box>
      ) : null}

      <Switch label="Published (visible on the public site)" checked={isPublished} onCheckedChange={setIsPublished} />

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
