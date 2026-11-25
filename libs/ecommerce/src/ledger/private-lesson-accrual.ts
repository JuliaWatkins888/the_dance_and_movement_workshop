import { logError } from '@inithium/api-utils';
import {
  expandPrivateLesson,
  getLedgerEntryRepository,
  getPrivateLessonExceptionRepository,
  getPrivateLessonRepository,
  getTimeSettings,
  privateLessonFirstDateKey,
  resolveStudioClosedDateKeys,
  toDateKey,
  zonedDateKey,
  zonedWallTimeToUtc,
} from '@inithium/db';
import type { PrivateLessonEntity, PrivateLessonExceptionEntity, PrivateLessonOccurrence } from '@inithium/db';

const dayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const chargeDescription = (lesson: PrivateLessonEntity, occurrence: PrivateLessonOccurrence): string =>
  [`Private lesson: ${lesson.title}`, dayFormatter.format(new Date(`${occurrence.date}T00:00:00.000Z`)), `for ${lesson.attendee.name}`].join(' · ');

// The earliest date any of these lessons could have met, counting make-ups moved earlier.
const earliestDateKey = (lessons: PrivateLessonEntity[], exceptions: PrivateLessonExceptionEntity[]): string =>
  [...lessons.map(privateLessonFirstDateKey), ...exceptions.flatMap((exception) => (exception.newDate ? [toDateKey(exception.newDate)] : []))].reduce(
    (earliest, key) => (key < earliest ? key : earliest),
  );

// Per-lesson billing: every occurrence that has finished (studio time) and isn't cancelled posts
// one charge of the lesson's rate. There's no job runner, so this runs lazily wherever ledger
// tuition accrual runs. The unique (privateLessonId, lessonDate) key makes it idempotent. Omit
// userId to catch up every account. Never throws, and the next read retries.
export const accruePrivateLessonCharges = async (userId?: string, now: Date = new Date()): Promise<number> => {
  try {
    const lessons = await getPrivateLessonRepository().findBillable(userId);
    if (lessons.length === 0) return 0;
    const exceptions = await getPrivateLessonExceptionRepository().findByLessonIds(lessons.map((lesson) => lesson.id));
    const { timezone } = await getTimeSettings();
    const todayKey = zonedDateKey(now, timezone);
    const fromKey = earliestDateKey(lessons, exceptions);
    if (fromKey > todayKey) return 0;
    const closedDates = await resolveStudioClosedDateKeys(fromKey, todayKey);
    const ledger = getLedgerEntryRepository();

    let written = 0;
    for (const lesson of lessons) {
      const own = exceptions.filter((exception) => exception.lessonId === lesson.id);
      const finished = expandPrivateLesson(lesson, own, closedDates, fromKey, todayKey).filter(
        (occurrence) => occurrence.status === 'scheduled' && zonedWallTimeToUtc(`${occurrence.date}T${occurrence.endTime}`, timezone) <= now,
      );
      if (finished.length === 0) continue;
      const billed = new Set(await ledger.findBilledLessonDates(lesson.id));
      for (const occurrence of finished.filter((candidate) => !billed.has(candidate.scheduledDate))) {
        const created = await ledger.createPrivateLessonCharge({
          userId: lesson.userId,
          kind: 'charge',
          amountCents: lesson.rateCents,
          description: chargeDescription(lesson, occurrence),
          category: 'private_lesson',
          ...(lesson.attendee.type === 'child' ? { studentId: lesson.attendee.childId } : {}),
          dueDate: new Date(`${occurrence.date}T00:00:00.000Z`),
          source: 'system',
          privateLessonId: lesson.id,
          lessonDate: occurrence.scheduledDate,
        });
        if (created) written += 1;
      }
    }
    return written;
  } catch (error) {
    logError(error);
    return 0;
  }
};
