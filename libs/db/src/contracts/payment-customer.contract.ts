// Links a user to their customer record at the payment provider. Kept out of UserEntity so the core
// user contract never carries a provider-specific id, and swapping providers is a new row per user
// rather than a user schema change.
export interface PaymentCustomerEntity {
  id: string;
  userId: string;
  provider: string;
  providerCustomerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreatePaymentCustomerInput = Omit<PaymentCustomerEntity, 'id' | 'createdAt' | 'updatedAt'>;

export interface PaymentCustomerRepository {
  findByUserId: (userId: string, provider: string) => Promise<PaymentCustomerEntity | null>;
  create: (input: CreatePaymentCustomerInput) => Promise<PaymentCustomerEntity>;
}
