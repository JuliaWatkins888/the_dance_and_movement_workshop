import { NotFoundError } from '@inithium/api-utils';
import { getPaymentCustomerRepository, getUserRepository } from '@inithium/db';
import type { PostalAddress } from '@inithium/db';
import { getPaymentProvider } from '@inithium/payments';

// Creates the user's customer at the payment provider on first checkout, and keeps its contact
// details and address current on every later one (subscription renewals are taxed against it).
export const ensurePaymentCustomer = async (userId: string, address: PostalAddress): Promise<string> => {
  const provider = getPaymentProvider();
  const user = await getUserRepository().findById(userId);
  if (!user) throw NotFoundError('User not found');

  const customers = getPaymentCustomerRepository();
  const existing = await customers.findByUserId(userId, provider.name);
  const providerCustomerId = await provider.ensureCustomer({
    ...(existing ? { existingCustomerId: existing.providerCustomerId } : {}),
    userId,
    email: user.email,
    name: [user.firstName, user.lastName].filter(Boolean).join(' '),
    address,
  });
  if (existing) return providerCustomerId;

  try {
    await customers.create({ userId, provider: provider.name, providerCustomerId });
    return providerCustomerId;
  } catch (error) {
    // A concurrent first checkout already linked a customer (unique userId+provider) - use theirs.
    const winner = await customers.findByUserId(userId, provider.name);
    if (winner) return winner.providerCustomerId;
    throw error;
  }
};

export const findPaymentCustomerId = async (userId: string): Promise<string | undefined> =>
  (await getPaymentCustomerRepository().findByUserId(userId, getPaymentProvider().name))?.providerCustomerId;
