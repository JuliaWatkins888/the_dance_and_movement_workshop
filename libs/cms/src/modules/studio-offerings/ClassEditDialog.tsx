import { useState } from 'react';
import { Box, Button, Input, Switch, Text } from '@inithium/ui';
import { computeClassPricing, useCreateClassMutation, useGetClassPricingConfigQuery, useUpdateClassMutation } from '@inithium/api-client';
import type { ClassDto, ClassPricingConfigDto, ClassWriteInput, InstructorCandidate } from '@inithium/api-client';
import type { DayOfWeek } from '@inithium/db';
import { AcademicYearPicker } from './AcademicYearPicker';
import { CoursePicker, useAcademicYearCourses } from './CoursePicker';
import { InstructorPicker } from './InstructorPicker';
import { SemesterScopeField } from './SemesterScopeField';
import { formatCurrency } from './formatOffering';
import { extractConflictMessage } from './extractErrorMessage';
import { parseOptionalNumber, toNumberInputValue } from './numberInput';

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

interface PricingPreviewProps {
  readonly monthlyPrice: number;
  readonly spansFullYear: boolean;
  readonly config: ClassPricingConfigDto | undefined;
}

// What a purchaser would pay under each billing option for the monthly price typed above - a live
// read-only preview of the derived totals (nothing here is stored or editable per class; the
// discounts live in Settings -> Pricing). Mirrors what the server puts in ClassDto.pricing.
const PricingPreview = ({ monthlyPrice, spansFullYear, config }: PricingPreviewProps) => {
  const pricing = config ? computeClassPricing(monthlyPrice, spansFullYear, config) : undefined;

  return (
    <Box bgColor={{ color: 'surface', intensity: 100 }} borderColor={{ color: 'surface', intensity: 200 }} padding={{ base: 12 }} flex={{ direction: 'col', gap: 4 }} className="rounded border">
      <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
        Pricing options
      </Text>
      {pricing && config ? (
        <>
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
            Month to month: {formatCurrency(pricing.monthly)}/mo
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
            Semester in full: {formatCurrency(pricing.semester)} ({config.semesterDiscountPercent}% off, {config.monthsPerSemester} months)
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
            {pricing.year !== undefined
              ? `Full year in full: ${formatCurrency(pricing.year)} (${config.yearDiscountPercent}% off, ${config.monthsPerYear} months)`
              : 'Full year in full: not available - the class must run in both semesters.'}
          </Text>
        </>
      ) : (
        <Text as="p" textColor={{ color: 'surface', intensity: 500 }} className="text-sm">
          Loading pricing rules…
        </Text>
      )}
      <Text as="p" textColor={{ color: 'surface', intensity: 500 }} className="text-xs">
        Totals are calculated from the monthly price. The discount percentages are set under Settings.
      </Text>
    </Box>
  );
};

// Cascading Academic Year -> Course -> Semester(s) choice. The dialog holds the year and course, but
// only courseId and semesterIds are part of the submit payload - academicYearId exists purely to
// scope which Courses CoursePicker offers. The semester choices are limited to the chosen Course's
// own, since a class can only run in terms its course does.
export const ClassEditDialog = ({ mode, initialClass, onDone }: ClassEditDialogProps) => {
  const [createClass, { isLoading: isCreating }] = useCreateClassMutation();
  const [updateClass, { isLoading: isUpdating }] = useUpdateClassMutation();
  const isLoading = isCreating || isUpdating;
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const [academicYearId, setAcademicYearId] = useState(initialClass?.academicYearId ?? '');
  const [courseId, setCourseId] = useState(initialClass?.courseId ?? '');
  const [semesterIds, setSemesterIds] = useState<string[]>(initialClass?.semesterIds ?? []);
  const [variantLabel, setVariantLabel] = useState(initialClass?.variantLabel ?? '');
  const [instructors, setInstructors] = useState<InstructorCandidate[]>(initialClass?.instructors ?? []);
  const [daysOfWeek, setDaysOfWeek] = useState<DayOfWeek[]>(initialClass?.daysOfWeek ?? []);
  const [startTime, setStartTime] = useState(initialClass?.startTime ?? '');
  const [endTime, setEndTime] = useState(initialClass?.endTime ?? '');
  const [registrationStartDate, setRegistrationStartDate] = useState(toDateInputValue(initialClass?.registrationStartDate));
  const [startDate, setStartDate] = useState(toDateInputValue(initialClass?.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(initialClass?.endDate));
  const [minAgeYears, setMinAgeYears] = useState(toNumberInputValue(initialClass?.minAgeYears));
  const [maxAgeYears, setMaxAgeYears] = useState(toNumberInputValue(initialClass?.maxAgeYears));
  const [priceAmount, setPriceAmount] = useState(String(initialClass?.priceAmount ?? 0));
  const [capacity, setCapacity] = useState(String(initialClass?.capacity ?? 0));
  const [enrolled, setEnrolled] = useState(String(initialClass?.enrolled ?? 0));
  const [isPublished, setIsPublished] = useState(initialClass?.isPublished ?? true);

  // The course list is the same cached query CoursePicker reads; it's looked up here too because the
  // selected course's own semesters drive both the scope choices and whether year pricing applies.
  const { data: courses } = useAcademicYearCourses(academicYearId);
  const selectedCourse = courses?.items.find((course) => course.id === courseId);
  const { data: pricingConfig } = useGetClassPricingConfigQuery();

  const handleAcademicYearChange = (nextAcademicYearId: string) => {
    setAcademicYearId(nextAcademicYearId);
    setCourseId('');
    setSemesterIds([]);
  };

  // A new course starts the class off running in all of that course's semesters; the admin narrows
  // it to one only when the class really is a single-semester section.
  const handleCourseChange = (nextCourseId: string) => {
    setCourseId(nextCourseId);
    const nextCourse = courses?.items.find((course) => course.id === nextCourseId);
    setSemesterIds(nextCourse ? nextCourse.semesters.map((semester) => semester.id) : []);
  };

  // Year pricing applies only when the class covers every semester of a full-year course.
  const spansFullYear = Boolean(selectedCourse?.spansFullYear) && semesterIds.length === selectedCourse?.semesters.length;

  const handleSubmit = async () => {
    setSubmitError(undefined);

    if (!courseId) {
      setSubmitError('Choose an academic year and course.');
      return;
    }
    if (semesterIds.length === 0) {
      setSubmitError('Choose which semester(s) this class runs in.');
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

    const parsedMinAge = parseOptionalNumber(minAgeYears);
    const parsedMaxAge = parseOptionalNumber(maxAgeYears);

    const commonFields: ClassWriteInput = {
      courseId,
      semesterIds,
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
    } catch (error) {
      setSubmitError(extractConflictMessage(error, 'Could not save this class. Check the fields and try again.'));
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', gap: 16 }}>
        <Box className="flex-1">
          <AcademicYearPicker value={academicYearId} onValueChange={handleAcademicYearChange} />
        </Box>
        <Box className="flex-1">
          <CoursePicker academicYearId={academicYearId} value={courseId} onValueChange={handleCourseChange} />
        </Box>
      </Box>

      {selectedCourse ? (
        <SemesterScopeField
          label="Runs In"
          available={selectedCourse.semesters}
          value={semesterIds}
          onChange={setSemesterIds}
          helperText={
            selectedCourse.spansFullYear
              ? 'Only classes that run in both semesters can be bought for the full year.'
              : 'This course only runs in one semester, so its classes do too.'
          }
        />
      ) : null}

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

      <Input
        label="Monthly Price"
        type="number"
        min={0}
        step="0.01"
        required
        helperText="The month-to-month rate. Semester and full-year prices are calculated from it."
        value={priceAmount}
        onChange={(event) => setPriceAmount(event.target.value)}
      />

      <PricingPreview monthlyPrice={Number(priceAmount) || 0} spansFullYear={spansFullYear} config={pricingConfig} />

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
