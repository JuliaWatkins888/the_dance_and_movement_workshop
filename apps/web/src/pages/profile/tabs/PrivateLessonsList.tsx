import { Box, Divider, Pill, Text } from '@inithium/ui';
import type { MyPrivateLessonDto, PrivateLessonOccurrenceDto } from '@inithium/api-client';
import { formatCents, formatClassDate, formatTimeRange } from '../../classes/classFormat';

const scheduleText = (lesson: MyPrivateLessonDto): string => {
  const { schedule } = lesson;
  const when =
    schedule.kind === 'weekly'
      ? `${schedule.weekday}s ${formatTimeRange(schedule.startTime, schedule.endTime)}`
      : `${formatClassDate(schedule.date)}, ${formatTimeRange(schedule.startTime, schedule.endTime)}`;
  return [when, lesson.instructor ? `with ${lesson.instructor.name}` : undefined].filter(Boolean).join(' ');
};

const OccurrenceLine = ({ occurrence }: { readonly occurrence: PrivateLessonOccurrenceDto }) => {
  const isCancelled = occurrence.status === 'cancelled';
  return (
    <Text as="li" textColor={{ color: 'surface', intensity: isCancelled ? 600 : 800 }} className="list-disc text-sm">
      <Text as="span" textColor={{ color: 'surface', intensity: isCancelled ? 600 : 800 }} className={isCancelled ? 'line-through' : undefined}>
        {`${formatClassDate(occurrence.date)} · ${formatTimeRange(occurrence.startTime, occurrence.endTime)}`}
      </Text>
      {isCancelled ? ' · Cancelled' : occurrence.isMoved ? ` · Moved from ${formatClassDate(occurrence.scheduledDate)}` : ''}
    </Text>
  );
};

const LessonRow = ({ lesson }: { readonly lesson: MyPrivateLessonDto }) => (
  <Box flex={{ direction: 'col', gap: 8 }} padding={{ top: 16, bottom: 16 }}>
    <Box flex={{ direction: 'row', align: 'start', gap: 16 }} className="flex-wrap sm:flex-nowrap">
      <Box flex={{ direction: 'col', gap: 4 }} className="min-w-0 flex-1">
        <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
          {lesson.title}
        </Text>
        <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
          {`${lesson.attendee.name} · ${scheduleText(lesson)}`}
        </Text>
        <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          {`${formatCents(lesson.rateCents)} per lesson, added to your account balance after each lesson`}
        </Text>
      </Box>
      {lesson.status === 'ended' ? (
        <Pill color={{ color: 'surface', intensity: 300 }} className="shrink-0 text-surface-800">
          {lesson.endedOn ? `Ends ${formatClassDate(lesson.endedOn)}` : 'Ending'}
        </Pill>
      ) : null}
    </Box>
    {lesson.upcoming.length > 0 ? (
      <Box flex={{ direction: 'col', gap: 2 }}>
        <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-xs font-semibold uppercase tracking-wide">
          Upcoming
        </Text>
        <Box as="ul" flex={{ direction: 'col', gap: 2 }} className="pl-5">
          {lesson.upcoming.map((occurrence) => (
            <OccurrenceLine key={occurrence.scheduledDate} occurrence={occurrence} />
          ))}
        </Box>
      </Box>
    ) : (
      <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
        No lessons scheduled in the next few weeks.
      </Text>
    )}
  </Box>
);

// Private lessons the studio scheduled for this family. Changes go through the studio.
export const PrivateLessonsList = ({ lessons }: { readonly lessons: MyPrivateLessonDto[] }) => (
  <Box flex={{ direction: 'col', gap: 4 }}>
    <Text as="h3" textColor={{ color: 'surface', intensity: 700 }} className="text-sm font-semibold uppercase tracking-wide">
      Private Lessons
    </Text>
    <Box>
      {lessons.map((lesson, index) => (
        <Box key={lesson.id}>
          {index > 0 ? <Divider color={{ color: 'surface', intensity: 300 }} /> : null}
          <LessonRow lesson={lesson} />
        </Box>
      ))}
    </Box>
    <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
      Need to change a lesson? Contact the studio.
    </Text>
  </Box>
);
