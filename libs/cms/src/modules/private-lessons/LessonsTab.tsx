import { useState } from 'react';
import type { ReactElement } from 'react';
import { alert, Box, Button, dialog, Input, Loader, Pill, Select, SelectItem, Text } from '@inithium/ui';
import {
  formatMoney,
  readApiError,
  useDeletePrivateLessonMutation,
  useEndPrivateLessonMutation,
  useListPrivateLessonInstructorsQuery,
  useListPrivateLessonsAdminQuery,
} from '@inithium/api-client';
import type { PrivateLessonDto } from '@inithium/api-client';
import { canAccessCmsResource, useCmsCurrentUser } from '../../CmsCurrentUserContext';
import { ALERT_POSITION, ALL_DAYS, DIALOG_WIDTH } from '../classes/classAdmin.shared';
import { DIALOG_WIDTH_WIDE, EmptyState, FormError, useStoreCurrency } from '../ecommerce/shared';
import { openAccountLedger } from '../ledger/openAccountLedger';
import { OccurrenceActions } from './occurrenceActions';
import { PrivateLessonEditDialog } from './PrivateLessonEditDialog';
import { formatFullDate, occurrenceLabel, scheduleLabel, todayKey } from './privateLessonFormat';

const ALL = 'all';
type StatusFilter = 'active' | 'ended' | typeof ALL;

export const openPrivateLessonDialog = (lesson?: PrivateLessonDto) => {
  const render = (close: () => void): ReactElement => <PrivateLessonEditDialog lesson={lesson} onDone={close} />;
  const id = dialog.show(() => render(() => dialog.close(id)), {
    title: lesson ? `Edit "${lesson.title}" for ${lesson.attendee.name}` : 'New Private Lesson',
    width: DIALOG_WIDTH_WIDE,
  });
};

const EndLessonDialog = ({ lesson, onDone }: { readonly lesson: PrivateLessonDto; readonly onDone: () => void }) => {
  const [endLesson, { isLoading }] = useEndPrivateLessonMutation();
  const [lastDate, setLastDate] = useState(todayKey());
  const [error, setError] = useState<string | undefined>(undefined);

  const submit = async () => {
    setError(undefined);
    if (!lastDate) return setError('Choose the last lesson date.');
    try {
      await endLesson({ id: lesson.id, lastDate }).unwrap();
      alert.success('Lesson ended.', { position: ALERT_POSITION });
      onDone();
    } catch (endError) {
      setError(readApiError(endError, 'Could not end this lesson.').message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Text as="p" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
        No lessons after this date are scheduled or charged. Lessons already charged stay on the family’s account. Void one in Accounts
        to waive it.
      </Text>
      <Input label="Last lesson date" type="date" required value={lastDate} onChange={(event) => setLastDate(event.target.value)} />
      <FormError message={error} />
      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onDone} disabled={isLoading}>
          Keep it going
        </Button>
        <Button variant={{ kind: 'filled', color: 'red', intensity: 600 }} onClick={submit} disabled={isLoading}>
          {isLoading ? 'Ending…' : 'End lesson'}
        </Button>
      </Box>
    </Box>
  );
};

const openEndDialog = (lesson: PrivateLessonDto) => {
  const render = (close: () => void): ReactElement => <EndLessonDialog lesson={lesson} onDone={close} />;
  const id = dialog.show(() => render(() => dialog.close(id)), { title: `End ${lesson.attendee.name}’s ${lesson.title}?`, width: DIALOG_WIDTH });
};

const LessonRow = ({ lesson, currency, canManageLedger }: { readonly lesson: PrivateLessonDto; readonly currency: string; readonly canManageLedger: boolean }) => {
  const [deleteLesson, { isLoading: isDeleting }] = useDeletePrivateLessonMutation();

  const confirmDelete = async () => {
    const confirmed = await dialog.confirm({
      title: `Delete ${lesson.attendee.name}’s ${lesson.title}?`,
      description: 'Only a lesson that has never been charged can be deleted. Otherwise end it, so its history stays.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red', intensity: 600 },
    });
    if (!confirmed) return;
    try {
      await deleteLesson(lesson.id).unwrap();
      alert.success('Lesson deleted.', { position: ALERT_POSITION });
    } catch (error) {
      alert.danger(readApiError(error, 'Could not delete this lesson.').message, { position: ALERT_POSITION });
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 8 }} borderColor={{ color: 'surface', intensity: 200 }} padding={{ base: 16 }} className="rounded-md border">
      <Box flex={{ direction: 'row', justify: 'between', align: 'start', gap: 12 }} className="flex-wrap">
        <Box flex={{ direction: 'col', gap: 2 }} className="min-w-0 flex-1">
          <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
            {`${lesson.title} · ${lesson.attendee.name}`}
          </Text>
          <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
            {[scheduleLabel(lesson.schedule), lesson.instructor ? `with ${lesson.instructor.name}` : 'No instructor'].join(' · ')}
          </Text>
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
            {[
              `${formatMoney(lesson.rateCents, currency)} per lesson`,
              lesson.account ? `account: ${lesson.account.name}` : undefined,
              lesson.endedOn ? `ended after ${formatFullDate(lesson.endedOn)}` : undefined,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {lesson.notes ? (
            <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm italic">
              {lesson.notes}
            </Text>
          ) : null}
        </Box>
        <Box flex={{ direction: 'row', align: 'center', gap: 4 }} className="flex-wrap">
          {lesson.status === 'ended' ? (
            <Pill color={{ color: 'surface', intensity: 300 }} className="text-surface-900">
              Ended
            </Pill>
          ) : null}
          <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={() => openPrivateLessonDialog(lesson)}>
            Edit
          </Button>
          {canManageLedger && lesson.account ? (
            <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={() => openAccountLedger(lesson.userId, lesson.account?.name ?? 'Account')}>
              Ledger
            </Button>
          ) : null}
          {lesson.status === 'active' ? (
            <Button variant={{ kind: 'ghost', color: 'red' }} textColor={{ color: 'red', intensity: 600 }} onClick={() => openEndDialog(lesson)}>
              End
            </Button>
          ) : null}
          <Button variant={{ kind: 'ghost', color: 'red' }} textColor={{ color: 'red', intensity: 600 }} onClick={confirmDelete} disabled={isDeleting}>
            Delete
          </Button>
        </Box>
      </Box>
      {lesson.upcoming.length > 0 ? (
        <Box flex={{ direction: 'col', gap: 4 }}>
          <Text as="h4" textColor={{ color: 'surface', intensity: 800 }} className="text-xs font-semibold uppercase tracking-wide">
            Upcoming
          </Text>
          {lesson.upcoming.map((occurrence) => (
            <Box key={occurrence.scheduledDate} flex={{ direction: 'row', justify: 'between', align: 'center', gap: 8 }}>
              <Text
                as="span"
                textColor={{ color: 'surface', intensity: occurrence.status === 'cancelled' ? 600 : 900 }}
                className={occurrence.status === 'cancelled' ? 'text-sm line-through' : 'text-sm'}
              >
                {occurrenceLabel(occurrence)}
              </Text>
              <OccurrenceActions occurrence={occurrence} label={`${lesson.attendee.name}’s ${lesson.title}`} />
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
};

// Weekly lessons in weekday/time order, then one-offs by date.
const sortKey = (lesson: PrivateLessonDto): string =>
  lesson.schedule.kind === 'weekly'
    ? `0:${ALL_DAYS.indexOf(lesson.schedule.weekday)}:${lesson.schedule.startTime}`
    : `1:${lesson.schedule.date}:${lesson.schedule.startTime}`;

export const LessonsTab = () => {
  const currency = useStoreCurrency();
  const currentUser = useCmsCurrentUser();
  const canManageLedger = canAccessCmsResource(currentUser, 'ledger:manage');
  const { data: lessons = [], isLoading, isError } = useListPrivateLessonsAdminQuery();
  const { data: instructors = [] } = useListPrivateLessonInstructorsQuery();
  const [instructorStaffId, setInstructorStaffId] = useState(ALL);
  const [status, setStatus] = useState<StatusFilter>('active');

  const shown = lessons
    .filter((lesson) => instructorStaffId === ALL || lesson.instructor?.id === instructorStaffId)
    .filter((lesson) => status === ALL || lesson.status === status)
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'end', gap: 12 }} className="flex-wrap">
        <Box flex={{ direction: 'row', gap: 8 }} className="flex-wrap">
          <Select label="Instructor" value={instructorStaffId} onValueChange={setInstructorStaffId} className="min-w-56">
            <SelectItem value={ALL}>All instructors</SelectItem>
            {instructors.map((instructor) => (
              <SelectItem key={instructor.id} value={instructor.id}>
                {instructor.name || 'Unnamed staff member'}
              </SelectItem>
            ))}
          </Select>
          <Select label="Status" value={status} onValueChange={(value) => setStatus(value as StatusFilter)} className="min-w-40">
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="ended">Ended</SelectItem>
            <SelectItem value={ALL}>All</SelectItem>
          </Select>
        </Box>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => openPrivateLessonDialog()}>
          New private lesson
        </Button>
      </Box>

      {isLoading ? (
        <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
          <Loader />
        </Box>
      ) : isError ? (
        <EmptyState message="Couldn’t load private lessons." />
      ) : shown.length === 0 ? (
        <EmptyState message={lessons.length === 0 ? 'No private lessons yet. Use “New private lesson” to set one up.' : 'No lessons match these filters.'} />
      ) : (
        <Box flex={{ direction: 'col', gap: 12 }}>
          {shown.map((lesson) => (
            <LessonRow key={lesson.id} lesson={lesson} currency={currency} canManageLedger={canManageLedger} />
          ))}
        </Box>
      )}
    </Box>
  );
};
