import { getWorkshopRegistrationRepository } from '../index';
import type { AttendeeRef } from '../class-registrations/class-registration.rules';
import type { WorkshopRegistrationEntity } from '../contracts/workshop-registration.contract';

const isSameAttendee = (registration: WorkshopRegistrationEntity, ref: AttendeeRef): boolean =>
  ref.type === 'self'
    ? registration.attendee.type === 'self'
    : registration.attendee.type === 'child' && registration.attendee.childId === ref.childId;

// The day ids this attendee already holds a paid seat on, out of `dayIds`.
export const findRegisteredWorkshopDays = async (
  userId: string,
  workshopId: string,
  ref: AttendeeRef,
  dayIds: string[],
): Promise<string[]> => {
  const registrations = await getWorkshopRegistrationRepository().findByWorkshop(workshopId);
  const held = new Set(
    registrations
      .filter((registration) => registration.userId === userId && isSameAttendee(registration, ref))
      .flatMap((registration) => registration.dayIds),
  );
  return dayIds.filter((dayId) => held.has(dayId));
};
