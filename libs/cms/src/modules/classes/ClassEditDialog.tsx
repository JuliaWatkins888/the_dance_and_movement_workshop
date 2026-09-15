import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Box, Button, Input, Pill, Switch, Text, Textarea } from '@inithium/ui';
import { useCreateClassMutation, useUpdateClassMutation } from '@inithium/api-client';
import type { ClassDto, ClassWriteInput } from '@inithium/api-client';
import type { DayOfWeek } from '@inithium/db';

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

interface TagListFieldProps {
  readonly label: string;
  readonly values: string[];
  readonly onChange: (values: string[]) => void;
  readonly placeholder?: string;
}

// A small local tag input (type + Enter/comma to add, click the x to remove) - categories and
// instructors are open-ended lists with no fixed vocabulary (Jackrabbit's own export models up
// to 3 free-text categories per class), so a fixed Select doesn't fit; this is intentionally
// local to this dialog rather than a new @inithium/ui composite, the same "local until a second
// consumer needs it" precedent StaffEditDialog's own PhotoSourceField follows.
const TagListField = ({ label, values, onChange, placeholder }: TagListFieldProps) => {
  const [draft, setDraft] = useState('');

  const commitDraft = () => {
    const trimmed = draft.trim();
    setDraft('');
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitDraft();
    }
  };

  const removeTag = (tag: string) => onChange(values.filter((value) => value !== tag));

  return (
    <Box flex={{ direction: 'col', gap: 8 }} className="flex-1">
      <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
        {label}
      </Text>
      <Box flex={{ direction: 'row', gap: 8, align: 'center' }}>
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button type="button" variant={{ kind: 'outlined', color: 'primary' }} onClick={commitDraft}>
          Add
        </Button>
      </Box>
      {values.length > 0 ? (
        <Box flex={{ direction: 'row', gap: 6 }} className="flex-wrap">
          {values.map((value) => (
            <Pill key={value} color={{ color: 'surface', intensity: 200 }}>
              <span className="inline-flex items-center gap-1.5">
                {value}
                <button
                  type="button"
                  onClick={() => removeTag(value)}
                  aria-label={`Remove ${value}`}
                  className="text-surface-500 hover:text-red-600"
                >
                  ×
                </button>
              </span>
            </Pill>
          ))}
        </Box>
      ) : null}
    </Box>
  );
};

interface DaysOfWeekFieldProps {
  readonly values: DayOfWeek[];
  readonly onChange: (values: DayOfWeek[]) => void;
}

const DaysOfWeekField = ({ values, onChange }: DaysOfWeekFieldProps) => {
  const toggleDay = (day: DayOfWeek) =>
    onChange(values.includes(day) ? values.filter((value) => value !== day) : [...values, day]);

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

export const ClassEditDialog = ({ mode, initialClass, onDone }: ClassEditDialogProps) => {
  const [createClass, { isLoading: isCreating }] = useCreateClassMutation();
  const [updateClass, { isLoading: isUpdating }] = useUpdateClassMutation();
  const isLoading = isCreating || isUpdating;
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const [name, setName] = useState(initialClass?.name ?? '');
  const [description, setDescription] = useState(initialClass?.description ?? '');
  const [categories, setCategories] = useState<string[]>(initialClass?.categories ?? []);
  const [instructors, setInstructors] = useState<string[]>(initialClass?.instructors ?? []);
  const [daysOfWeek, setDaysOfWeek] = useState<DayOfWeek[]>(initialClass?.daysOfWeek ?? []);
  const [startTime, setStartTime] = useState(initialClass?.startTime ?? '');
  const [endTime, setEndTime] = useState(initialClass?.endTime ?? '');
  const [session, setSession] = useState(initialClass?.session ?? '');
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

  const handleSubmit = async () => {
    setSubmitError(undefined);

    if (!name.trim()) {
      setSubmitError('Name is required.');
      return;
    }
    if (categories.length === 0) {
      setSubmitError('Add at least one category.');
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
      name: name.trim(),
      description: description.trim() || undefined,
      categories,
      instructors,
      daysOfWeek,
      startTime,
      endTime,
      session: session.trim(),
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
      <Input label="Class Name" required value={name} onChange={(event) => setName(event.target.value)} />

      <Textarea
        label="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={4}
      />

      <Box flex={{ direction: 'row', gap: 16 }}>
        <TagListField label="Categories *" values={categories} onChange={setCategories} placeholder="e.g. Ballet" />
        <TagListField label="Instructors" values={instructors} onChange={setInstructors} placeholder="e.g. Lila Hodgin" />
      </Box>

      <DaysOfWeekField values={daysOfWeek} onChange={setDaysOfWeek} />

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input label="Start Time" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} className="flex-1" />
        <Input label="End Time" type="time" required value={endTime} onChange={(event) => setEndTime(event.target.value)} className="flex-1" />
        <Input
          label="Session"
          required
          placeholder="e.g. Fall 2026"
          value={session}
          onChange={(event) => setSession(event.target.value)}
          className="flex-1"
        />
      </Box>

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input
          label="Registration Opens"
          type="date"
          value={registrationStartDate}
          onChange={(event) => setRegistrationStartDate(event.target.value)}
          className="flex-1"
        />
        <Input label="Start Date" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} className="flex-1" />
        <Input label="End Date" type="date" required value={endDate} onChange={(event) => setEndDate(event.target.value)} className="flex-1" />
      </Box>

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input
          label="Min Age (years)"
          type="number"
          min={0}
          value={minAgeYears}
          onChange={(event) => setMinAgeYears(event.target.value)}
          className="flex-1"
        />
        <Input
          label="Max Age (years)"
          type="number"
          min={0}
          value={maxAgeYears}
          onChange={(event) => setMaxAgeYears(event.target.value)}
          className="flex-1"
        />
      </Box>

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input
          label="Price"
          type="number"
          min={0}
          step="0.01"
          required
          value={priceAmount}
          onChange={(event) => setPriceAmount(event.target.value)}
          className="flex-1"
        />
        <Input
          label="Billing Cycle"
          placeholder="e.g. Monthly"
          value={billingCycle}
          onChange={(event) => setBillingCycle(event.target.value)}
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

      <Switch label="Published (visible on the public Classes page)" checked={isPublished} onCheckedChange={setIsPublished} />

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
