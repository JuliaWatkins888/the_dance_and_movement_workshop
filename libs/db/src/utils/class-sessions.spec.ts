import { describe, expect, it } from 'vitest';
import { isValidDateKey, sectionSessionDateKeys, studioClosedDateKeys } from './class-sessions';
import { zonedDateKey, zonedWallTimeToUtc } from './zoned-time';

const utc = (date: string): Date => new Date(`${date}T00:00:00.000Z`);

const fall = { startDate: utc('2026-09-14'), endDate: utc('2026-12-18') };
const spring = { startDate: utc('2027-01-04'), endDate: utc('2027-05-14') };

describe('sectionSessionDateKeys', () => {
  it('lists the section weekdays inside its semesters', () => {
    expect(sectionSessionDateKeys(['Tuesday'], [fall], '2026-11-16', '2026-11-30', new Set())).toEqual(['2026-11-17', '2026-11-24']);
  });

  it('skips closed dates and the break between semesters', () => {
    const dates = sectionSessionDateKeys(['Tuesday'], [fall, spring], '2026-12-08', '2027-01-12', new Set(['2026-12-15']));
    expect(dates).toEqual(['2026-12-08', '2027-01-05', '2027-01-12']);
  });

  it('returns nothing for a date the section does not meet', () => {
    expect(sectionSessionDateKeys(['Tuesday'], [fall], '2026-11-18', '2026-11-18', new Set())).toEqual([]);
  });
});

describe('studioClosedDateKeys', () => {
  it('keeps closed holidays and expands multi-day closures within the range', () => {
    const closed = studioClosedDateKeys(
      [
        { date: '2026-11-26', isStudioClosed: true },
        { date: '2026-11-11', isStudioClosed: false },
      ],
      [{ isStudioClosed: true, startDate: utc('2026-11-27'), endDate: utc('2026-12-02') }],
      '2026-11-01',
      '2026-11-30',
    );
    expect([...closed].sort()).toEqual(['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30']);
  });
});

describe('isValidDateKey', () => {
  it('rejects malformed and impossible dates', () => {
    expect(isValidDateKey('2026-11-17')).toBe(true);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('11/17/2026')).toBe(false);
  });
});

describe('studio wall-clock time', () => {
  it('resolves a class start in the studio zone', () => {
    // 6:00 PM in New York on Nov 17 (EST, UTC-5).
    expect(zonedWallTimeToUtc('2026-11-17T18:00', 'America/New_York').toISOString()).toBe('2026-11-17T23:00:00.000Z');
  });

  it('reads the studio date, not the UTC date, late in the evening', () => {
    expect(zonedDateKey(new Date('2026-11-18T03:00:00.000Z'), 'America/New_York')).toBe('2026-11-17');
  });
});
