import { useState } from 'react';
import { Box, Button, Input, Switch, Text } from '@inithium/ui';
import { useCreateClassMutation, useUpdateClassMutation } from '@inithium/api-client';
import type { ClassDto, ClassWriteInput, InstructorCandidate } from '@inithium/api-client';
import type { DayOfWeek } from '@inithium/db';
import { SemesterPicker } from './SemesterPicker';
import { CoursePicker } from './CoursePicker';
import { InstructorPicker } from './InstructorPicker';

export interface ClassEditDialogProps {
  readonly mode: 'create' | 'edit';
  readonly initialClass?: ClassDto;
  readonly onDone: () => void;
}

// Not imported at runtime from @inithium/db's own DAYS_OF_WEEK (that package depends on
// mongoose) - see apps/web/src/pages/ClassesPage.tsx's identical precedent for why libs/cms, also
// a Vite-bundled frontend package, only takes `import type` from @inithium/db.
const ALL_DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const toDateInputValue = (iso?: string): string => (iso ? iso.slice(0, 10) : '');

interface DaysOfWeekFieldProps {
  readonly values: DayOfWeek[];
  readonly onChange: (values: DayOfWeek[]) => void;
}

const DaysOfWeekField = ({ values, onChange }: DaysOfWeekFieldProps) => {
  const toggleDay = (day: DayOfWeek) => onChange(values.includes(day) ? values.filter((value) => value !== day) : [...values, day]);

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
        Days of Week <span className="text-red-500">*</span>
      </Text>
      <Box flex={{ direction: 'row', gap: 6 }} className="flex-wrap">
        {ALL_DAYS.map((day) => {
          const selected = values.includes(day);
          return (
            <Button
              key={day}
              type="button"
              variant={selected ? { kind: 'filled', color: 'primary' } : { kind: 'outlined', color: 'surface' }}
              onClick={() => toggleDay(day)}
              className="px-3 py-1 text-xs"
            >
              {day.slice(0, 3)}
            </Button>
          );
        })}
      </Box>
    </Box>
  );
};

// Cascading Semester -> Course choice: the dialog holds both, but only courseId is ever part of
// the submit payload - semesterId exists purely to scope which Courses CoursePicker offers (a
// Class's semester is always whatever its chosen Course's own semester is, resolved server-side).
export const ClassEditDialog = ({ mode, initialClass, onDone }: ClassEditDialogProps) => {
  const [createClass, { isLoading: isCreating }] = useCreateClassMutation();
  const [updateClass, { isLoading: isUpdating }] = useUpdateClassMutation();
  const isLoading = isCreating || isUpdating;
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const [semesterId, setSemesterId] = useState(initialClass?.semesterId ?? '');
  const [courseId, setCourseId] = useState(initialClass?.courseId ?? '');
  const [variantLabel, setVariantLabel] = useState(initialClass?.variantLabel ?? '');
  const [instructors, setInstructors] = useState<InstructorCandidate[]>(initialClass?.instructors ?? []);
  const [daysOfWeek, setDaysOfWeek] = useState<DayOfWeek[]>(initialClass?.daysOfWeek ?? []);
  const [startTime, setStartTime] = useState(initialClass?.startTime ?? '');
  const [endTime, setEndTime] = useState(initialClass?.endTime ?? '');
  const [registrationStartDate, setRegistrationStartDate] = useState(toDateInputValue(initialClass?.registrationStartDate));
  const [startDate, setStartDate] = useState(toDateInputValue(initialClass?.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(initialClass?.endDate));
  const [minAgeYears, setMinAgeYears] = useState(initialClass?.minAgeYears !== undefined ? String(initialClass.minAgeYears) : '');
  const [maxAgeYears, setMaxAgeYears] = useState(initialClass?.maxAgeYears !== undefined ? String(initialClass.maxAgeYears) : '');
  const [priceAmount, setPriceAmount] = useState(String(initialClass?.priceAmount ?? 0));
  const [billingCycle, setBillingCycle] = useState(initialClass?.billingCycle ?? 'Monthly');
  const [capacity, setCapacity] = useState(String(initialClass?.capacity ?? 0));
  const [enrolled, setEnrolled] = useState(String(initialClass?.enrolled ?? 0));
  const [isPublished, setIsPublished] = useState(initialClass?.isPublished ?? true);

  const handleSemesterChange = (nextSemesterId: string) => {
    setSemesterId(nextSemesterId);
    setCourseId('');
  };

  const handleSubmit = async () => {
    setSubmitError(undefined);

    if (!courseId) {
      setSubmitError('Choose a semester and course.');
      return;
    }
    if (daysOfWeek.length === 0) {
      setSubmitError('Select at least one day of the week.');
      return;
    }
    if (!startDate || !endDate) {
      setSubmitError('Start and end dates are required.');
      return;
    }

    const parsedMinAge = minAgeYears.trim() ? Number(minAgeYears) : undefined;
    const parsedMaxAge = maxAgeYears.trim() ? Number(maxAgeYears) : undefined;

    const commonFields: ClassWriteInput = {
      courseId,
      variantLabel: variantLabel.trim() || undefined,
      instructorIds: instructors.map((instructor) => instructor.id),
      daysOfWeek,
      startTime,
      endTime,
      registrationStartDate: registrationStartDate || undefined,
      startDate,
      endDate,
      minAgeYears: parsedMinAge,
      maxAgeYears: parsedMaxAge,
      priceAmount: Number(priceAmount) || 0,
      billingCycle: billingCycle.trim() || 'Monthly',
      capacity: Number(capacity) || 0,
      enrolled: Number(enrolled) || 0,
      isPublished,
    };

    try {
      if (mode === 'create') {
        await createClass(commonFields).unwrap();
      } else if (initialClass) {
        await updateClass({ id: initialClass.id, ...commonFields }).unwrap();
      }
      onDone();
    } catch {
      setSubmitError('Could not save this class. Check the fields and try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', gap: 16 }}>
        <Box className="flex-1">
          <SemesterPicker value={semesterId} onValueChange={handleSemesterChange} />
        </Box>
        <Box className="flex-1">
          <CoursePicker semesterId={semesterId} value={courseId} onValueChange={setCourseId} />
        </Box>
      </Box>

      <Input
        label="Variant Label"
        placeholder="e.g. Tuesdays & Thursdays, Ages 7-10"
        helperText="Shown alongside the course name to tell this section apart from others."
        value={variantLabel}
        onChange={(event) => setVariantLabel(event.target.value)}
      />

      <InstructorPicker selected={instructors} onChange={setInstructors} />

      <DaysOfWeekField values={daysOfWeek} onChange={setDaysOfWeek} />

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input label="Start Time" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} className="flex-1" />
        <Input label="End Time" type="time" required value={endTime} onChange={(event) => setEndTime(event.target.value)} className="flex-1" />
      </Box>

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input
          label="Registration Opens"
          type="date"
          helperText="Leave blank to use the semester's default."
          value={registrationStartDate}
          onChange={(event) => setRegistrationStartDate(event.target.value)}
          className="flex-1"
        />
        <Input label="Start Date" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} className="flex-1" />
        <Input label="End Date" type="date" required value={endDate} onChange={(event) => setEndDate(event.target.value)} className="flex-1" />
      </Box>

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input label="Min Age (years)" type="number" min={0} value={minAgeYears} onChange={(event) => setMinAgeYears(event.target.value)} className="flex-1" />
        <Input label="Max Age (years)" type="number" min={0} value={maxAgeYears} onChange={(event) => setMaxAgeYears(event.target.value)} className="flex-1" />
      </Box>

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input label="Price" type="number" min={0} step="0.01" required value={priceAmount} onChange={(event) => setPriceAmount(event.target.value)} className="flex-1" />
        <Input label="Billing Cycle" placeholder="e.g. Monthly" value={billingCycle} onChange={(event) => setBillingCycle(event.target.value)} className="flex-1" />
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
