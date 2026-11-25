import { describe, expect, it } from 'vitest';
import { expandPrivateLesson, privateLessonDateKeys } from './private-lesson-sessions';
import type { ExpandableLesson } from './private-lesson-sessions';

const utc = (date: string): Date => new Date(`${date}T00:00:00.000Z`);

const thursdays: ExpandableLesson = {
  id: 'lesson-1',
  schedule: { kind: 'weekly', weekday: 'Thursday', startTime: '17:00', endTime: '17:30', startDate: utc('2026-11-05') },
};

const dates = (occurrences: { date: string }[]): string[] => occurrences.map((occurrence) => occurrence.date);

describe('privateLessonDateKeys', () => {
  it('lists the weekday from the start date on', () => {
    expect(privateLessonDateKeys(thursdays, '2026-11-01', '2026-11-30')).toEqual(['2026-11-05', '2026-11-12', '2026-11-19', '2026-11-26']);
  });

  it('stops at the end date and at endedOn', () => {
    const withEnd: ExpandableLesson = { ...thursdays, schedule: { ...thursdays.schedule, endDate: utc('2026-11-19') } as ExpandableLesson['schedule'] };
    expect(privateLessonDateKeys(withEnd, '2026-11-01', '2026-11-30')).toEqual(['2026-11-05', '2026-11-12', '2026-11-19']);
    expect(privateLessonDateKeys({ ...thursdays, endedOn: utc('2026-11-13') }, '2026-11-01', '2026-11-30')).toEqual(['2026-11-05', '2026-11-12']);
  });

  it('handles a one-off lesson', () => {
    const once: ExpandableLesson = { id: 'once', schedule: { kind: 'once', date: utc('2026-11-22'), startTime: '13:00', endTime: '14:00' } };
    expect(privateLessonDateKeys(once, '2026-11-01', '2026-11-30')).toEqual(['2026-11-22']);
    expect(privateLessonDateKeys(once, '2026-12-01', '2026-12-31')).toEqual([]);
  });
});

describe('expandPrivateLesson', () => {
  it('skips closed dates', () => {
    expect(dates(expandPrivateLesson(thursdays, [], new Set(['2026-11-26']), '2026-11-01', '2026-11-30'))).toEqual([
      '2026-11-05',
      '2026-11-12',
      '2026-11-19',
    ]);
  });

  it('keeps a cancelled occurrence, marked', () => {
    const occurrences = expandPrivateLesson(thursdays, [{ date: utc('2026-11-12'), kind: 'cancelled' }], new Set(), '2026-11-10', '2026-11-16');
    expect(occurrences).toEqual([
      expect.objectContaining({ scheduledDate: '2026-11-12', date: '2026-11-12', status: 'cancelled', isMoved: false }),
    ]);
  });

  it('moves an occurrence, including into and out of the range', () => {
    const moved = [{ date: utc('2026-11-26'), kind: 'moved' as const, newDate: utc('2026-11-24'), newStartTime: '16:00', newEndTime: '16:30' }];
    expect(expandPrivateLesson(thursdays, moved, new Set(), '2026-11-23', '2026-11-25')).toEqual([
      expect.objectContaining({ scheduledDate: '2026-11-26', date: '2026-11-24', startTime: '16:00', endTime: '16:30', isMoved: true }),
    ]);
    expect(expandPrivateLesson(thursdays, moved, new Set(), '2026-11-26', '2026-11-30')).toEqual([]);
  });

  it('lets a make-up run on a date that was closed', () => {
    const moved = [{ date: utc('2026-11-26'), kind: 'moved' as const, newDate: utc('2026-11-27'), newStartTime: '17:00', newEndTime: '17:30' }];
    expect(dates(expandPrivateLesson(thursdays, moved, new Set(['2026-11-26']), '2026-11-20', '2026-11-30'))).toEqual(['2026-11-27']);
  });
});
