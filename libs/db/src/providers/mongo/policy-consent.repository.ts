import type { Model } from 'mongoose';
import type {
  CreatePolicyConsentInput,
  PolicyConsentEntity,
  PolicyConsentRepository,
} from '../../contracts/policy-consent.contract';
import type { PolicyConsentDocument } from '../../schemas/policy-consent.schema';

const mapToPolicyConsentEntity = (doc: PolicyConsentDocument): PolicyConsentEntity => ({
  id: doc._id.toString(),
  userId: doc.userId,
  schoolYearId: doc.schoolYearId ?? null,
  ...(doc.schoolYearName ? { schoolYearName: doc.schoolYearName } : {}),
  policyVersionHash: doc.policyVersionHash,
  policySnapshot: doc.policySnapshot.map((category) => ({
    title: category.title,
    items: category.items.map((item) => ({ title: item.title, content: item.content })),
  })),
  signedName: doc.signedName,
  agreedAt: doc.agreedAt,
  method: doc.method,
  ...(doc.ipAddress ? { ipAddress: doc.ipAddress } : {}),
  ...(doc.userAgent ? { userAgent: doc.userAgent } : {}),
  ...(doc.recordedByUserId ? { recordedByUserId: doc.recordedByUserId } : {}),
  ...(doc.recordedByName ? { recordedByName: doc.recordedByName } : {}),
  ...(doc.orderId ? { orderId: doc.orderId } : {}),
  createdAt: doc.createdAt,
});

export const createMongoPolicyConsentRepository = (model: Model<PolicyConsentDocument>): PolicyConsentRepository => ({
  create: async (input: CreatePolicyConsentInput): Promise<PolicyConsentEntity> =>
    mapToPolicyConsentEntity(await model.create(input)),
  findByUserId: async (userId: string): Promise<PolicyConsentEntity[]> => {
    const docs = await model.find({ userId }).sort({ agreedAt: -1 }).exec();
    return docs.map(mapToPolicyConsentEntity);
  },
  findSignedSchoolYearIds: async (userId: string, policyVersionHash: string): Promise<(string | null)[]> =>
    model.distinct('schoolYearId', { userId, policyVersionHash }).exec(),
});
