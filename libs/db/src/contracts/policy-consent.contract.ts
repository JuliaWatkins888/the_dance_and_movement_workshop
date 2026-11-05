export const POLICY_CONSENT_METHODS = ['online', 'paper'] as const;
export type PolicyConsentMethod = (typeof POLICY_CONSENT_METHODS)[number];

export interface PolicySnapshotItem {
  title: string;
  // Sanitized HTML, exactly as it was published when the person signed.
  content: string;
}

export interface PolicySnapshotCategory {
  title: string;
  items: PolicySnapshotItem[];
}

// A signed legal record. Everything that could later change elsewhere (the policy text, the school
// year's name, the staff member's name) is copied in, so the record keeps saying what was true at
// signing even after those are edited or deleted.
export interface PolicyConsentEntity {
  id: string;
  userId: string;
  // null only when no school year was published at signing, e.g. a workshop sold between years.
  schoolYearId: string | null;
  schoolYearName?: string;
  policyVersionHash: string;
  policySnapshot: PolicySnapshotCategory[];
  signedName: string;
  agreedAt: Date;
  method: PolicyConsentMethod;
  // Online signatures only - a paper signature wasn't made from any device.
  ipAddress?: string;
  userAgent?: string;
  // Paper signatures only - the staff member attesting to the paper copy.
  recordedByUserId?: string;
  recordedByName?: string;
  orderId?: string;
  createdAt: Date;
}

export type CreatePolicyConsentInput = Omit<PolicyConsentEntity, 'id' | 'createdAt'>;

// Deliberately has no update or delete: a signature can only ever be added.
export interface PolicyConsentRepository {
  create: (input: CreatePolicyConsentInput) => Promise<PolicyConsentEntity>;
  // Newest first.
  findByUserId: (userId: string) => Promise<PolicyConsentEntity[]>;
  // The school years this account has a signature for on exactly this policy version.
  findSignedSchoolYearIds: (userId: string, policyVersionHash: string) => Promise<(string | null)[]>;
}
