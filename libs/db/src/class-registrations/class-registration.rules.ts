import {
  getChildRepository,
  getClassRegistrationRepository,
  getClassSectionRepository,
} from '../index';
import type { ClassAttendee, ClassRegistrationEntity } from '../contracts/class-registration.contract';
import type { CourseEntity } from '../contracts/course.contract';
import { coveragesOverlap, isAgeEligible, isSelfEnrollable } from '../utils/class-eligibility';
import type { PlanCoverage } from '../utils/class-eligibility';

// How a cart line / registration request names who attends: the account holder, or one child.
export type AttendeeRef = { type: 'self' } | { type: 'child'; childId: string };

export type AttendeeResolution = { ok: true; attendee: ClassAttendee } | { ok: false; reason: string };

export const attendeeKey = (ref: AttendeeRef): string => (ref.type === 'self' ? 'self' : `child:${ref.childId}`);

const isSameAttendee = (attendee: ClassAttendee, ref: AttendeeRef): boolean =>
  ref.type === 'self' ? attendee.type === 'self' : attendee.type === 'child' && attendee.childId === ref.childId;

// The attendee as stored on a registration, or null when the child isn't on this account.
export const describeAttendee = async (userId: string, userName: string, ref: AttendeeRef): Promise<ClassAttendee | null> => {
  if (ref.type === 'self') return { type: 'self', name: userName };
  const child = await getChildRepository().findById(ref.childId);
  if (!child || child.parentUserId !== userId) return null;
  return { type: 'child', childId: child.id, name: [child.firstName, child.lastName].filter(Boolean).join(' ') };
};

// Checks the attendee belongs to the account and is eligible for the course today.
export const resolveEligibleAttendee = async (
  userId: string,
  userName: string,
  ref: AttendeeRef,
  course: Pick<CourseEntity, 'minAgeYears' | 'maxAgeYears'>,
  now: Date,
): Promise<AttendeeResolution> => {
  if (ref.type === 'self') {
    return isSelfEnrollable(course)
      ? { ok: true, attendee: { type: 'self', name: userName } }
      : { ok: false, reason: 'This class is for children - choose one of your child profiles.' };
  }
  const child = await getChildRepository().findById(ref.childId);
  if (!child || child.parentUserId !== userId) return { ok: false, reason: 'Choose one of your own child profiles.' };
  const name = [child.firstName, child.lastName].filter(Boolean).join(' ');
  if (!isAgeEligible(child.birthDate, now, course)) {
    return { ok: false, reason: `${child.firstName} isn’t in this class’s age range.` };
  }
  return { ok: true, attendee: { type: 'child', childId: child.id, name } };
};

// Every attendee on the account who may take the course today - the options the class page offers.
export const listEligibleAttendees = async (
  userId: string,
  userName: string,
  course: Pick<CourseEntity, 'minAgeYears' | 'maxAgeYears'>,
  now: Date,
): Promise<ClassAttendee[]> => {
  const children = await getChildRepository().findByParentUserId(userId);
  const refs: AttendeeRef[] = [{ type: 'self' }, ...children.map((child) => ({ type: 'child' as const, childId: child.id }))];
  const resolutions = await Promise.all(refs.map((ref) => resolveEligibleAttendee(userId, userName, ref, course, now)));
  return resolutions.flatMap((resolution) => (resolution.ok ? [resolution.attendee] : []));
};

// The span a registration still occupies - a withdrawn monthly only until its paid period ends.
const occupiedCoverage = (registration: ClassRegistrationEntity): PlanCoverage | null => {
  if (registration.status === 'ended') return null;
  if (registration.status === 'withdrawn') {
    const end = registration.accessEndsAt ?? registration.endsAt;
    return end > registration.startsAt ? { startsAt: registration.startsAt, endsAt: end } : null;
  }
  return { startsAt: registration.startsAt, endsAt: registration.endsAt };
};

// An existing registration of the same attendee in the same section overlapping `coverage`.
export const findOverlappingRegistration = async (
  userId: string,
  sectionId: string,
  ref: AttendeeRef,
  coverage: PlanCoverage,
): Promise<ClassRegistrationEntity | undefined> => {
  const registrations = await getClassRegistrationRepository().findBySection(sectionId);
  return registrations.find((registration) => {
    if (registration.userId !== userId || !isSameAttendee(registration.attendee, ref)) return false;
    const occupied = occupiedCoverage(registration);
    return occupied !== null && coveragesOverlap(occupied, coverage);
  });
};

// Lazy, like the ecommerce plugin's stale-checkout sweep: there's no job runner, so seats held by
// withdrawn monthly registrations are handed back whenever the catalog or a checkout next looks
// at seat counts. The compare-and-set keeps concurrent sweeps from releasing a seat twice.
export const releaseExpiredClassSeats = async (now: Date): Promise<void> => {
  const registrations = getClassRegistrationRepository();
  const expired = await registrations.findSeatsToRelease(now);
  for (const registration of expired) {
    if (await registrations.markSeatReleased(registration.id)) {
      await getClassSectionRepository().releaseSeats(registration.sectionId, 1);
    }
  }
};
