import { useState } from 'react';
import { Box, Button, Input, Switch, Text, Textarea } from '@inithium/ui';
import { useCreateWorkshopMutation, useUpdateWorkshopMutation } from '@inithium/api-client';
import type { InstructorCandidate, WorkshopDto, WorkshopWriteInput } from '@inithium/api-client';
import { SemesterPicker } from './SemesterPicker';
import { InstructorPicker } from './InstructorPicker';
import { OccurrencesField } from './OccurrencesField';
import type { OccurrenceInput } from './OccurrencesField';

export interface WorkshopEditDialogProps {
  readonly mode: 'create' | 'edit';
  readonly initialWorkshop?: WorkshopDto;
  readonly onDone: () => void;
}

const toDateInputValue = (iso?: string): string => (iso ? iso.slice(0, 10) : '');

const toOccurrenceInputs = (workshop?: WorkshopDto): OccurrenceInput[] =>
  (workshop?.occurrences ?? []).map((occurrence) => ({
    date: toDateInputValue(occurrence.date),
    startTime: occurrence.startTime,
    endTime: occurrence.endTime,
  }));

export const WorkshopEditDialog = ({ mode, initialWorkshop, onDone }: WorkshopEditDialogProps) => {
  const [createWorkshop, { isLoading: isCreating }] = useCreateWorkshopMutation();
  const [updateWorkshop, { isLoading: isUpdating }] = useUpdateWorkshopMutation();
  const isLoading = isCreating || isUpdating;
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const [semesterId, setSemesterId] = useState(initialWorkshop?.semesterId ?? '');
  const [name, setName] = useState(initialWorkshop?.name ?? '');
  const [description, setDescription] = useState(initialWorkshop?.description ?? '');
  const [instructors, setInstructors] = useState<InstructorCandidate[]>(initialWorkshop?.instructors ?? []);
  const [occurrences, setOccurrences] = useState<OccurrenceInput[]>(toOccurrenceInputs(initialWorkshop));
  const [minAgeYears, setMinAgeYears] = useState(initialWorkshop?.minAgeYears !== undefined ? String(initialWorkshop.minAgeYears) : '');
  const [maxAgeYears, setMaxAgeYears] = useState(initialWorkshop?.maxAgeYears !== undefined ? String(initialWorkshop.maxAgeYears) : '');
  const [priceAmount, setPriceAmount] = useState(String(initialWorkshop?.priceAmount ?? 0));
  const [registrationStartDate, setRegistrationStartDate] = useState(toDateInputValue(initialWorkshop?.registrationStartDate));
  const [capacity, setCapacity] = useState(String(initialWorkshop?.capacity ?? 0));
  const [enrolled, setEnrolled] = useState(String(initialWorkshop?.enrolled ?? 0));
  const [isPublished, setIsPublished] = useState(initialWorkshop?.isPublished ?? true);

  const handleSubmit = async () => {
    setSubmitError(undefined);

    if (!semesterId) {
      setSubmitError('Choose a semester.');
      return;
    }
    if (!name.trim()) {
      setSubmitError('Name is required.');
      return;
    }
    if (occurrences.length === 0 || occurrences.some((occurrence) => !occurrence.date || !occurrence.startTime || !occurrence.endTime)) {
      setSubmitError('Add at least one complete date with a start and end time.');
      return;
    }

    const parsedMinAge = minAgeYears.trim() ? Number(minAgeYears) : undefined;
    const parsedMaxAge = maxAgeYears.trim() ? Number(maxAgeYears) : undefined;

    const commonFields: WorkshopWriteInput = {
      semesterId,
      name: name.trim(),
      description: description.trim() || undefined,
      instructorIds: instructors.map((instructor) => instructor.id),
      occurrences,
      minAgeYears: parsedMinAge,
      maxAgeYears: parsedMaxAge,
      priceAmount: Number(priceAmount) || 0,
      registrationStartDate: registrationStartDate || undefined,
      capacity: Number(capacity) || 0,
      enrolled: Number(enrolled) || 0,
      isPublished,
    };

    try {
      if (mode === 'create') {
        await createWorkshop(commonFields).unwrap();
      } else if (initialWorkshop) {
        await updateWorkshop({ id: initialWorkshop.id, ...commonFields }).unwrap();
      }
      onDone();
    } catch {
      setSubmitError('Could not save this workshop. Check the fields and try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <SemesterPicker value={semesterId} onValueChange={setSemesterId} />

      <Input label="Workshop Name" required placeholder="e.g. Weekend Choreography Intensive" value={name} onChange={(event) => setName(event.target.value)} />

      <Textarea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />

      <InstructorPicker selected={instructors} onChange={setInstructors} />

      <OccurrencesField values={occurrences} onChange={setOccurrences} />

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input label="Min Age (years)" type="number" min={0} value={minAgeYears} onChange={(event) => setMinAgeYears(event.target.value)} className="flex-1" />
        <Input label="Max Age (years)" type="number" min={0} value={maxAgeYears} onChange={(event) => setMaxAgeYears(event.target.value)} className="flex-1" />
      </Box>

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input label="Price (one-time)" type="number" min={0} step="0.01" required value={priceAmount} onChange={(event) => setPriceAmount(event.target.value)} className="flex-1" />
        <Input
          label="Registration Opens"
          type="date"
          helperText="Leave blank to use the semester's default."
          value={registrationStartDate}
          onChange={(event) => setRegistrationStartDate(event.target.value)}
          className="flex-1"
        />
      </Box>

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input label="Capacity" type="number" min={0} required value={capacity} onChange={(event) => setCapacity(event.target.value)} className="flex-1" />
        <Input
          label="Currently Enrolled"
          type="number"
          min={0}
          helperText="There is no live registration flow yet - keep this in sync by hand if needed."
          value={enrolled}
          onChange={(event) => setEnrolled(event.target.value)}
          className="flex-1"
        />
      </Box>

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
