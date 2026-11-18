import { ConflictError, NotFoundError } from '@inithium/api-utils';
import { getClassRegistrationRepository } from '@inithium/db';
import type { ClassRegistrationEntity } from '@inithium/db';
import { withdrawLedgerRegistration } from '../ledger/tuition-accrual';
import { cancelSubscriptionLineByAdmin } from '../subscriptions/subscription.service';

// Staff stopping a monthly class for a family, whichever way it's billed. The online rules apply
// (no proration; the month already billed is kept), except the show-semester lock, which only
// limits what families can do themselves.
export const withdrawClassRegistrationByStaff = async (registrationId: string, now: Date = new Date()): Promise<ClassRegistrationEntity> => {
  const repository = getClassRegistrationRepository();
  const registration = await repository.findById(registrationId);
  if (!registration) throw NotFoundError('Registration not found');
  if (registration.plan !== 'monthly') throw ConflictError('Semester and full-year plans are paid in full and can’t be withdrawn');
  if (registration.status !== 'active') throw ConflictError('This registration has already been withdrawn or has ended');

  if (registration.billingMode === 'ledger') return withdrawLedgerRegistration(registration, now);

  if (!registration.subscriptionId || !registration.subscriptionLineId) {
    throw ConflictError('This registration has no monthly billing left to stop');
  }
  // Ending the subscription line records the withdrawal (class.purchasable's onSubscriptionLineEnded).
  await cancelSubscriptionLineByAdmin(registration.subscriptionId, registration.subscriptionLineId);
  return (await repository.findById(registration.id)) ?? registration;
};
