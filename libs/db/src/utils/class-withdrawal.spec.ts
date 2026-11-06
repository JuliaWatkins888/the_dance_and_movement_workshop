import { describe, expect, it } from 'vitest';
import type { SemesterEntity } from '../contracts/school-year.contract';
import { isWithdrawalLocked } from './class-withdrawal';

const utc = (date: string, time = '00:00:00'): Date => new Date(`${date}T${time}.000Z`);

const fall: SemesterEntity = { id: 'fall', name: 'Fall', startDate: utc('2026-09-01'), endDate: utc('2026-12-20') };
const spring: SemesterEntity = {
  id: 'spring',
  name: 'Spring',
  startDate: utc('2027-01-10'),
  endDate: utc('2027-05-30'),
  isShowSemester: true,
  withdrawalLockDate: utc('2027-04-15'),
};

const fullYear = { startsAt: utc('2026-09-01'), endsAt: utc('2027-05-31') };
const sevenYearOld = utc('2019-01-01');
const sixYearOld = utc('2021-01-01');

const locked = (overrides: Partial<Parameters<typeof isWithdrawalLocked>[0]> = {}): boolean =>
  isWithdrawalLocked({
    registration: fullYear,
    semesters: [fall, spring],
    attendeeBirthDate: sevenYearOld,
    now: utc('2027-05-01'),
    ...overrides,
  });

describe('isWithdrawalLocked', () => {
  it('stays open the day before the lock date', () => {
    expect(locked({ now: utc('2027-04-14', '23:59:59') })).toBe(false);
  });

  it('locks from the start of the lock date', () => {
    expect(locked({ now: utc('2027-04-15') })).toBe(true);
  });

  it('stays locked through the whole last day of the semester, then opens', () => {
    expect(locked({ now: utc('2027-05-30', '23:59:59') })).toBe(true);
    expect(locked({ now: utc('2027-05-31') })).toBe(false);
  });

  it('locks a dancer who turns 7 on the lock date', () => {
    expect(locked({ attendeeBirthDate: utc('2020-04-15') })).toBe(true);
  });

  it('leaves open a dancer who turns 7 the day after the lock date, even once they are 7', () => {
    const birthDate = utc('2020-04-16');
    expect(locked({ attendeeBirthDate: birthDate, now: utc('2027-04-15') })).toBe(false);
    expect(locked({ attendeeBirthDate: birthDate, now: utc('2027-05-01') })).toBe(false);
  });

  it('leaves a 6-year-old open', () => {
    expect(locked({ attendeeBirthDate: sixYearOld })).toBe(false);
  });

  it('locks when there is no birthdate (account holder or deleted child)', () => {
    expect(locked({ attendeeBirthDate: undefined })).toBe(true);
  });

  it('only locks during the show semester of a registration spanning both', () => {
    expect(locked({ now: utc('2026-11-01') })).toBe(false);
    expect(locked({ now: utc('2027-05-01') })).toBe(true);
  });

  it('handles two show semesters with separate lock windows', () => {
    const showFall: SemesterEntity = { ...fall, isShowSemester: true, withdrawalLockDate: utc('2026-12-01') };
    const semesters = [showFall, spring];
    expect(locked({ semesters, now: utc('2026-12-10') })).toBe(true);
    expect(locked({ semesters, now: utc('2027-01-05') })).toBe(false);
    expect(locked({ semesters, now: utc('2027-02-01') })).toBe(false);
    expect(locked({ semesters, now: utc('2027-04-20') })).toBe(true);
  });

  it('ignores a show semester the section does not run in', () => {
    expect(locked({ semesters: [fall] })).toBe(false);
  });

  it('ignores a show semester the registration does not span', () => {
    const fallOnly = { startsAt: utc('2026-09-01'), endsAt: utc('2026-12-21') };
    expect(locked({ registration: fallOnly })).toBe(false);
  });

  it('ignores a lock date left on a semester that is not a show semester', () => {
    const notShow: SemesterEntity = { ...spring, isShowSemester: false };
    expect(locked({ semesters: [fall, notShow] })).toBe(false);
  });

  it('does not lock a show semester with no lock date', () => {
    const { withdrawalLockDate: _withdrawalLockDate, ...noDate } = spring;
    expect(locked({ semesters: [fall, noDate] })).toBe(false);
  });
});
