import { useState } from 'react';
import { Box, Button, Input, Select, SelectItem, Text, Textarea } from '@inithium/ui';
import {
  formatMinorUnitsForInput,
  parseMinorUnitsInput,
  readApiError,
  useCreatePrivateLessonMutation,
  useGetDeskAccountQuery,
  useListPrivateLessonInstructorsQuery,
  useUpdatePrivateLessonMutation,
} from '@inithium/api-client';
import type { PrivateLessonAttendeeRef, PrivateLessonDto, PrivateLessonScheduleDto } from '@inithium/api-client';
import type { DayOfWeek } from '@inithium/db';
import { ALL_DAYS } from '../classes/classAdmin.shared';
import { FormError, MoneyInput, useStoreCurrency } from '../ecommerce/shared';
import { AccountSection } from '../desk/AccountSection';
import { personName } from '../desk/deskShared';
import { todayKey } from './privateLessonFormat';

type ScheduleKind = PrivateLessonScheduleDto['kind'];

const SELF = 'self';

const attendeeValue = (lesson?: PrivateLessonDto): string =>
  !lesson ? '' : lesson.attendee.type === 'self' ? SELF : lesson.attendee.childId;

const toAttendeeRef = (value: string): PrivateLessonAttendeeRef => (value === SELF ? { type: 'self' } : { type: 'child', childId: value });

const FieldLabel = ({ children }: { readonly children: string }) => (
  <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
    {children}
  </Text>
);

export interface PrivateLessonEditDialogProps {
  readonly lesson?: PrivateLessonDto;
  readonly onDone: () => void;
}

export const PrivateLessonEditDialog = ({ lesson, onDone }: PrivateLessonEditDialogProps) => {
  const currency = useStoreCurrency();
  const [createLesson, { isLoading: isCreating }] = useCreatePrivateLessonMutation();
  const [updateLesson, { isLoading: isUpdating }] = useUpdatePrivateLessonMutation();
  const { data: instructors = [], isLoading: isLoadingInstructors } = useListPrivateLessonInstructorsQuery();
  const isSaving = isCreating || isUpdating;
  const [error, setError] = useState<string | undefined>(undefined);

  // The billed account is fixed once a lesson exists.
  const [accountId, setAccountId] = useState<string | null>(lesson?.userId ?? null);
  const { data: account } = useGetDeskAccountQuery(accountId ?? '', { skip: !accountId });
  const [attendee, setAttendee] = useState(attendeeValue(lesson));
  const [instructorStaffId, setInstructorStaffId] = useState(lesson?.instructor?.id ?? '');
  const [title, setTitle] = useState(lesson?.title ?? '');
  const schedule = lesson?.schedule;
  const [kind, setKind] = useState<ScheduleKind>(schedule?.kind ?? 'weekly');
  const [weekday, setWeekday] = useState<DayOfWeek>(schedule?.kind === 'weekly' ? schedule.weekday : 'Monday');
  const [startDate, setStartDate] = useState(schedule?.kind === 'weekly' ? schedule.startDate : todayKey());
  const [endDate, setEndDate] = useState(schedule?.kind === 'weekly' ? (schedule.endDate ?? '') : '');
  const [date, setDate] = useState(schedule?.kind === 'once' ? schedule.date : todayKey());
  const [startTime, setStartTime] = useState(schedule?.startTime ?? '');
  const [endTime, setEndTime] = useState(schedule?.endTime ?? '');
  const [rate, setRate] = useState(formatMinorUnitsForInput(lesson?.rateCents, currency));
  const [notes, setNotes] = useState(lesson?.notes ?? '');

  const handleSubmit = async () => {
    setError(undefined);
    if (!accountId) return setError('Choose the family account to bill.');
    if (!attendee) return setError('Choose who takes the lesson.');
    if (!instructorStaffId) return setError('Choose an instructor.');
    if (!title.trim()) return setError('Give the lesson a title, e.g. “Jazz Private”.');
    if (!startTime || !endTime) return setError('Start and end times are required.');
    if (endTime <= startTime) return setError('End time must be after start time.');
    if (kind === 'weekly' && !startDate) return setError('Choose the date of the first lesson.');
    if (kind === 'weekly' && endDate && endDate < startDate) return setError('The end date must be on or after the start date.');
    if (kind === 'once' && !date) return setError('Choose the lesson date.');
    const rateCents = parseMinorUnitsInput(rate, currency);
    if (rateCents === null) return setError('Enter the rate per lesson, e.g. 45 or 45.50.');

    const nextSchedule: PrivateLessonScheduleDto =
      kind === 'weekly'
        ? { kind, weekday, startTime, endTime, startDate, ...(endDate ? { endDate } : {}) }
        : { kind, date, startTime, endTime };
    const input = {
      attendee: toAttendeeRef(attendee),
      instructorStaffId,
      title: title.trim(),
      schedule: nextSchedule,
      rateCents,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    try {
      if (lesson) await updateLesson({ id: lesson.id, ...input }).unwrap();
      else await createLesson({ userId: accountId, ...input }).unwrap();
      onDone();
    } catch (saveError) {
      setError(readApiError(saveError, 'Could not save this lesson.').message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'col', gap: 8 }}>
        <FieldLabel>Family account (billed for each lesson)</FieldLabel>
        {lesson ? (
          <Text as="p" textColor={{ color: 'surface', intensity: 900 }}>
            {[lesson.account?.name, lesson.account?.email].filter(Boolean).join(' · ') || 'Account'}
          </Text>
        ) : (
          <AccountSection
            account={account}
            onSelect={(id) => {
              setAccountId(id);
              setAttendee('');
            }}
          />
        )}
      </Box>

      {account ? (
        <Select label="Student" value={attendee} onValueChange={setAttendee} placeholder="Who takes the lesson?">
          {account.students.map((student) => (
            <SelectItem key={student.id} value={student.id}>
              {personName(student)}
            </SelectItem>
          ))}
          <SelectItem value={SELF}>{`${personName(account)} (account holder)`}</SelectItem>
        </Select>
      ) : null}

      <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Title" required value={title} placeholder="Jazz Private" onChange={(event) => setTitle(event.target.value)} />
        <Select
          label="Instructor"
          value={instructorStaffId}
          onValueChange={setInstructorStaffId}
          placeholder={isLoadingInstructors ? 'Loading…' : 'Choose an instructor'}
        >
          {instructors.map((instructor) => (
            <SelectItem key={instructor.id} value={instructor.id}>
              {instructor.name || 'Unnamed staff member'}
            </SelectItem>
          ))}
        </Select>
      </Box>

      <Box flex={{ direction: 'col', gap: 8 }}>
        <Select label="Repeats" value={kind} onValueChange={(value) => setKind(value as ScheduleKind)}>
          <SelectItem value="weekly">Every week</SelectItem>
          <SelectItem value="once">One time</SelectItem>
        </Select>
        <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {kind === 'weekly' ? (
            <>
              <Select label="Day" value={weekday} onValueChange={(value) => setWeekday(value as DayOfWeek)}>
                {ALL_DAYS.map((day) => (
                  <SelectItem key={day} value={day}>
                    {day}
                  </SelectItem>
                ))}
              </Select>
              <Input label="Starts on" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              <Input
                label="Ends on (optional)"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                helperText="Leave blank to keep it going until you end it."
              />
            </>
          ) : (
            <Input label="Date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
          )}
          <Input label="Start time" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          <Input label="End time" type="time" required value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        </Box>
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          Studio closures and holidays skip a lesson, the same as classes.
          {lesson ? ' A new day or time on a lesson that has already started applies from today on.' : ''}
        </Text>
      </Box>

      <MoneyInput
        label="Rate per lesson"
        value={rate}
        onChange={setRate}
        currency={currency}
        required
        helperText="Charged to the family’s account after each lesson. Cancelled lessons aren’t charged."
      />
      <Textarea label="Staff notes (optional)" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />

      <FormError message={error} />
      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onDone} disabled={isSaving}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? 'Saving…' : lesson ? 'Save lesson' : 'Create lesson'}
        </Button>
      </Box>
    </Box>
  );
};
