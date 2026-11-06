import type { ClassRegistrationEntity } from '../contracts/class-registration.contract';
import type { SemesterEntity } from '../contracts/school-year.contract';
import { ageInYears } from './class-eligibility';

const DAY_MS = 86_400_000;

export const WITHDRAWAL_LOCK_MIN_AGE_YEARS = 7;

export const WITHDRAWAL_LOCKED_MESSAGE = 'Withdrawals for this class are closed for the show. Please contact the studio.';

export interface WithdrawalLockInput {
  registration: Pick<ClassRegistrationEntity, 'startsAt' | 'endsAt'>;
  // The semesters the registration's section runs in, not the whole school year: a section can
  // skip a semester that falls between two of its own.
  semesters: SemesterEntity[];
  // Undefined when the attendee is the account holder (always an adult) or a child profile that no
  // longer exists. Both lock, leaving the decision with the studio.
  attendeeBirthDate: Date | undefined;
  now: Date;
}

const registrationSpans = (registration: WithdrawalLockInput['registration'], semester: SemesterEntity): boolean =>
  registration.startsAt.getTime() < semester.endDate.getTime() + DAY_MS && semester.startDate < registration.endsAt;

// Age is fixed at the lock date, so a dancer who turns 7 later in the semester stays unlocked.
const isOldEnoughToLock = (birthDate: Date | undefined, lockDate: Date): boolean =>
  birthDate === undefined || ageInYears(birthDate, lockDate) >= WITHDRAWAL_LOCK_MIN_AGE_YEARS;

export const isWithdrawalLocked = ({ registration, semesters, attendeeBirthDate, now }: WithdrawalLockInput): boolean =>
  semesters.some(
    (semester) =>
      semester.isShowSemester === true &&
      semester.withdrawalLockDate !== undefined &&
      registrationSpans(registration, semester) &&
      semester.withdrawalLockDate <= now &&
      // endDate is midnight UTC of the last class day, so that whole day is still locked.
      now.getTime() < semester.endDate.getTime() + DAY_MS &&
      isOldEnoughToLock(attendeeBirthDate, semester.withdrawalLockDate),
  );
