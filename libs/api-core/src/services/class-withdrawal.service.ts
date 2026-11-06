import { ConflictError } from '@inithium/api-utils';
import {
  WITHDRAWAL_LOCKED_MESSAGE,
  getChildById,
  getClassSectionById,
  getSchoolYearById,
  isWithdrawalLocked,
  resolveSectionSemesters,
} from '@inithium/db';
import type { ClassRegistrationEntity, ClassSectionEntity, SchoolYearEntity } from '@inithium/db';

// A deleted section can't say which semesters it ran in, so every semester in the year counts.
export const isRegistrationWithdrawalLocked = async (
  registration: ClassRegistrationEntity,
  section: ClassSectionEntity | null,
  schoolYear: SchoolYearEntity | null,
  now: Date,
): Promise<boolean> => {
  if (!schoolYear) return false;
  const semesters = section ? resolveSectionSemesters(section.semesterIds, schoolYear.semesters) : schoolYear.semesters;
  if (!semesters.some((semester) => semester.isShowSemester)) return false;

  const child = registration.attendee.type === 'child' ? await getChildById(registration.attendee.childId) : null;
  return isWithdrawalLocked({ registration, semesters, attendeeBirthDate: child?.birthDate, now });
};

// Guards every family-facing cancel path. Admin withdrawals deliberately don't call this.
export const assertRegistrationWithdrawable = async (registration: ClassRegistrationEntity, now: Date): Promise<void> => {
  const [section, schoolYear] = await Promise.all([getClassSectionById(registration.sectionId), getSchoolYearById(registration.schoolYearId)]);
  if (await isRegistrationWithdrawalLocked(registration, section, schoolYear, now)) throw ConflictError(WITHDRAWAL_LOCKED_MESSAGE);
};
