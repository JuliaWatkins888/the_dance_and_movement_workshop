import type { Model } from 'mongoose';
import {
  CreatePaymentCustomerInput,
  PaymentCustomerEntity,
  PaymentCustomerRepository,
} from '../../contracts/payment-customer.contract';
import { PaymentCustomerDocument } from '../../schemas/payment-customer.schema';

const mapToPaymentCustomerEntity = (doc: PaymentCustomerDocument): PaymentCustomerEntity => ({
  id: doc._id.toString(),
  userId: doc.userId,
  provider: doc.provider,
  providerCustomerId: doc.providerCustomerId,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoPaymentCustomerRepository = (model: Model<PaymentCustomerDocument>): PaymentCustomerRepository => ({
  findByUserId: async (userId: string, provider: string): Promise<PaymentCustomerEntity | null> => {
    const doc = await model.findOne({ userId, provider }).exec();
    return doc ? mapToPaymentCustomerEntity(doc) : null;
  },
  create: async (input: CreatePaymentCustomerInput): Promise<PaymentCustomerEntity> => {
    const doc = await model.create(input);
    return mapToPaymentCustomerEntity(doc);
  },
});
