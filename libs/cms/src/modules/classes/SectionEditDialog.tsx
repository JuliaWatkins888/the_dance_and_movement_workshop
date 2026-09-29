import { useState } from 'react';
import { Box, Button, Checkbox, Input, Select, SelectItem, Switch, Text } from '@inithium/ui';
import {
  readApiError,
  useCreateClassSectionMutation,
  useListClassInstructorsQuery,
  useUpdateClassSectionMutation,
} from '@inithium/api-client';
import type { ClassSectionDto, CourseDto, SchoolYearDto } from '@inithium/api-client';
import type { DayOfWeek } from '@inithium/db';
import { FormError } from '../ecommerce/shared';
import { ALL_DAYS, formatCalendarDate } from './classAdmin.shared';

const DEFAULT_CAPACITY = 10;

export interface SectionEditDialogProps {
  readonly course: CourseDto;
  readonly schoolYears: SchoolYearDto[];
  readonly section?: ClassSectionDto;
  readonly onDone: () => void;
}

const toggle = <T,>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]);

const FieldLabel = ({ children }: { children: string }) => (
  <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
    {children}
  </Text>
);

export const SectionEditDialog = ({ course, schoolYears, section, onDone }: SectionEditDialogProps) => {
  const [createSection, { isLoading: isCreating }] = useCreateClassSectionMutation();
  const [updateSection, { isLoading: isUpdating }] = useUpdateClassSectionMutation();
  const { data: instructors = [], isLoading: isLoadingInstructors } = useListClassInstructorsQuery();
  const isSaving = isCreating || isUpdating;
  const [error, setError] = useState<string | undefined>(undefined);

  const latestYear = schoolYears[schoolYears.length - 1];
  const [schoolYearId, setSchoolYearId] = useState(section?.schoolYearId ?? latestYear?.id ?? '');
  const schoolYear = schoolYears.find((year) => year.id === schoolYearId);
  // A new time slot defaults to running the whole year.
  const [semesterIds, setSemesterIds] = useState<string[]>(section?.semesterIds ?? latestYear?.semesters.map((semester) => semester.id) ?? []);
  const [daysOfWeek, setDaysOfWeek] = useState<DayOfWeek[]>(section?.daysOfWeek ?? []);
  const [startTime, setStartTime] = useState(section?.startTime ?? '');
  const [endTime, setEndTime] = useState(section?.endTime ?? '');
  const [instructorStaffIds, setInstructorStaffIds] = useState<string[]>(section?.instructorStaffIds ?? []);
  const [capacity, setCapacity] = useState(String(section?.capacity ?? DEFAULT_CAPACITY));
  const [enrolled, setEnrolled] = useState(String(section?.enrolled ?? 0));
  const [isPublished, setIsPublished] = useState(section?.isPublished ?? true);

  const handleSchoolYearChange = (id: string) => {
    setSchoolYearId(id);
    setSemesterIds(schoolYears.find((year) => year.id === id)?.semesters.map((semester) => semester.id) ?? []);
  };

  const handleSubmit = async () => {
    setError(undefined);
    const parsedCapacity = Number(capacity);
    const parsedEnrolled = Number(enrolled);
    if (!schoolYear) return setError('Choose a school year.');
    if (semesterIds.length === 0) return setError('Choose at least one semester.');
    if (daysOfWeek.length === 0) return setError('Choose at least one day.');
    if (!startTime || !endTime) return setError('Start and end times are required.');
    if (endTime <= startTime) return setError('End time must be after start time.');
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 0) return setError('Capacity must be a whole number.');
    if (!Number.isInteger(parsedEnrolled) || parsedEnrolled < 0) return setError('Enrolled must be a whole number.');

    const input = {
      courseId: course.id,
      schoolYearId,
      semesterIds,
      instructorStaffIds,
      daysOfWeek: ALL_DAYS.filter((day) => daysOfWeek.includes(day)),
      startTime,
      endTime,
      capacity: parsedCapacity,
      enrolled: parsedEnrolled,
      isPublished,
    };

    try {
      if (section) await updateSection({ id: section.id, ...input }).unwrap();
      else await createSection(input).unwrap();
      onDone();
    } catch (saveError) {
      setError(readApiError(saveError, 'Could not save this time slot.').message);
    }
  };

  if (schoolYears.length === 0) {
    return (
      <Box flex={{ direction: 'col', gap: 16 }}>
        <Text as="p" textColor={{ color: 'surface', intensity: 800 }}>
          Add a school year on the School Years tab first - every time slot runs within one.
        </Text>
        <Box flex={{ justify: 'end' }}>
          <Button variant={{ kind: 'filled', color: 'primary' }} onClick={onDone}>
            OK
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Select label="School Year" value={schoolYearId} onValueChange={handleSchoolYearChange}>
        {schoolYears.map((year) => (
          <SelectItem key={year.id} value={year.id}>
            {year.name}
          </SelectItem>
        ))}
      </Select>

      {schoolYear ? (
        <Box flex={{ direction: 'col', gap: 8 }}>
          <FieldLabel>Runs In</FieldLabel>
          {schoolYear.semesters.map((semester) => (
            <Checkbox
              key={semester.id}
              label={`${semester.name} (${formatCalendarDate(semester.startDate)} – ${formatCalendarDate(semester.endDate)})`}
              checked={semesterIds.includes(semester.id)}
              onCheckedChange={() => setSemesterIds((previous) => toggle(previous, semester.id))}
            />
          ))}
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
            The full-year plan is only offered when a time slot runs in every semester.
          </Text>
        </Box>
      ) : null}

      <Box flex={{ direction: 'col', gap: 8 }}>
        <FieldLabel>Days</FieldLabel>
        <Box flex={{ direction: 'row', gap: 6 }} className="flex-wrap">
          {ALL_DAYS.map((day) => (
            <Button
              key={day}
              type="button"
              variant={daysOfWeek.includes(day) ? { kind: 'filled', color: 'primary' } : { kind: 'outlined', color: 'surface' }}
              onClick={() => setDaysOfWeek((previous) => toggle(previous, day))}
              className="px-3 py-1 text-xs"
            >
              {day.slice(0, 3)}
            </Button>
          ))}
        </Box>
      </Box>

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input label="Start Time" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} className="flex-1" />
        <Input label="End Time" type="time" required value={endTime} onChange={(event) => setEndTime(event.target.value)} className="flex-1" />
      </Box>

      <Box flex={{ direction: 'col', gap: 8 }}>
        <FieldLabel>Instructors</FieldLabel>
        {isLoadingInstructors ? (
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
            Loading staff…
          </Text>
        ) : instructors.length === 0 ? (
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
            No staff members yet - add instructors in the Staff module first.
          </Text>
        ) : (
          <Box className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {instructors.map((instructor) => (
              <Checkbox
                key={instructor.id}
                label={instructor.name || 'Unnamed staff member'}
                checked={instructorStaffIds.includes(instructor.id)}
                onCheckedChange={() => setInstructorStaffIds((previous) => toggle(previous, instructor.id))}
              />
            ))}
          </Box>
        )}
      </Box>

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input label="Capacity" type="number" min={0} required value={capacity} onChange={(event) => setCapacity(event.target.value)} className="flex-1" />
        <Input
          label="Currently Enrolled"
          type="number"
          min={0}
          helperText="Updated automatically once online registration is live."
          value={enrolled}
          onChange={(event) => setEnrolled(event.target.value)}
          className="flex-1"
        />
      </Box>

      <Switch label="Published (visible on the public Classes page)" checked={isPublished} onCheckedChange={setIsPublished} />
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
