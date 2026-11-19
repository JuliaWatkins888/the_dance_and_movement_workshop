import { ConflictError, NotFoundError } from '@inithium/api-utils';
import { getDropInRegistrationRepository } from '@inithium/db';
import type { DropInRegistrationEntity } from '@inithium/db';

// Staff cancelling a drop-in hands its seat back for that date. Money is settled separately:
// refund the order, or void its ledger charge when it was paid in person.
export const cancelDropInByStaff = async (
  dropInId: string,
  actorUserId: string,
  now: Date = new Date(),
): Promise<DropInRegistrationEntity> => {
  const repository = getDropInRegistrationRepository();
  const existing = await repository.findById(dropInId);
  if (!existing) throw NotFoundError('Drop-in not found');

  const cancelled = await repository.cancel(dropInId, actorUserId, now);
  if (!cancelled) throw ConflictError('This drop-in has already been cancelled');
  await repository.releaseSeat(cancelled.sectionId, cancelled.classDate);
  return cancelled;
};
