import type { Model } from 'mongoose';
import { PaymentEventRepository } from '../../contracts/payment-event.contract';
import { PaymentEventDocument } from '../../schemas/payment-event.schema';

const DUPLICATE_KEY_ERROR = 11000;

export const createMongoPaymentEventRepository = (model: Model<PaymentEventDocument>): PaymentEventRepository => ({
  claim: async (provider: string, eventId: string, type: string): Promise<boolean> => {
    try {
      await model.create({ provider, eventId, type });
      return true;
    } catch (error) {
      if ((error as { code?: number }).code === DUPLICATE_KEY_ERROR) return false;
      throw error;
    }
  },
  release: async (provider: string, eventId: string): Promise<void> => {
    await model.deleteOne({ provider, eventId }).exec();
  },
});
