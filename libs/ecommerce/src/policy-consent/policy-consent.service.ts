import { AppError, NotFoundError, ValidationError } from '@inithium/api-utils';
import {
  getCartRepository,
  getPolicyConsentRepository,
  getPolicyRepository,
  getSchoolYearRepository,
  hashPolicies,
  toPolicySnapshot,
} from '@inithium/db';
import type { CartLine, PolicyConsentEntity, PolicyConsentMethod, PolicySnapshotCategory, SchoolYearEntity } from '@inithium/db';
import { toLineRef } from '../cart/cart-lines';
import { findPurchasableSource } from '../purchasables/registry';

export const POLICY_CONSENT_REQUIRED = 'POLICY_CONSENT_REQUIRED';
export const POLICY_VERSION_CHANGED = 'POLICY_VERSION_CHANGED';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface ConsentSchoolYear {
  id: string | null;
  name?: string;
}

export interface PolicyConsentStatus {
  required: boolean;
  // The year this status is about: the first still unsigned, else the cart's, else the current one.
  schoolYearId: string | null;
  schoolYearName?: string;
  // One signature can cover a cart spanning two school years; each gets its own record.
  outstandingSchoolYears: ConsentSchoolYear[];
  versionHash: string;
  // The text versionHash covers, so what's shown is what gets signed. Empty unless required.
  policies: PolicySnapshotCategory[];
}

export interface PolicyConsentSummary {
  id: string;
  schoolYearId: string | null;
  schoolYearName?: string;
  agreedAt: Date;
  method: PolicyConsentMethod;
  isCurrentVersion: boolean;
}

export interface SignPolicyConsentInput {
  versionHash: string;
  signedName: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RecordPaperConsentInput {
  schoolYearId: string;
  signedName: string;
  recordedByUserId: string;
  recordedByName: string;
}

const toConsentYear = (year: SchoolYearEntity | null): ConsentSchoolYear => (year ? { id: year.id, name: year.name } : { id: null });

const yearSpan = (year: SchoolYearEntity): { start: number; end: number } | null => {
  if (year.semesters.length === 0) return null;
  return {
    start: Math.min(...year.semesters.map((semester) => semester.startDate.getTime())),
    // Dates are stored as UTC midnight, so the last day runs until the following midnight.
    end: Math.max(...year.semesters.map((semester) => semester.endDate.getTime())) + ONE_DAY_MS,
  };
};

// The published year in session, or between years the next one to start.
const resolveCurrentSchoolYear = (years: SchoolYearEntity[], now: Date): SchoolYearEntity | null => {
  const dated = years.flatMap((year) => {
    const span = year.isPublished ? yearSpan(year) : null;
    return span ? [{ year, ...span }] : [];
  });
  const time = now.getTime();
  const inSession = dated.filter(({ start, end }) => start <= time && time < end);
  const candidates = inSession.length > 0 ? inSession : dated.filter(({ start }) => start > time);
  return [...candidates].sort((a, b) => a.start - b.start)[0]?.year ?? null;
};

const resolveRegistrationYears = async (lines: CartLine[], years: SchoolYearEntity[], now: Date): Promise<ConsentSchoolYear[]> => {
  const current = resolveCurrentSchoolYear(years, now);
  const resolved = await Promise.all(
    lines.map(async (line): Promise<ConsentSchoolYear[]> => {
      const source = findPurchasableSource(line.sourceType);
      if (!source?.requiresPolicyConsent) return [];
      const yearId = source.policySchoolYearId ? await source.policySchoolYearId(toLineRef(line)) : null;
      return [toConsentYear(years.find((year) => year.id === yearId) ?? current)];
    }),
  );
  return [...new Map(resolved.flat().map((year) => [year.id, year])).values()];
};

const loadCurrentPolicies = async () => {
  const snapshot = toPolicySnapshot(await getPolicyRepository().findAll());
  return {
    snapshot,
    versionHash: hashPolicies(snapshot),
    // With nothing published there is nothing to agree to, so registration isn't blocked.
    hasPolicies: snapshot.some((category) => category.items.length > 0),
  };
};

const loadConsentState = async (userId: string, lines: CartLine[], now: Date) => {
  const [policies, years] = await Promise.all([loadCurrentPolicies(), getSchoolYearRepository().findAll()]);
  const registrationYears = await resolveRegistrationYears(lines, years, now);
  const signedYearIds = await getPolicyConsentRepository().findSignedSchoolYearIds(userId, policies.versionHash);
  const outstanding = policies.hasPolicies ? registrationYears.filter((year) => !signedYearIds.includes(year.id)) : [];
  return { policies, registrationYears, signedYearIds, outstanding, currentYear: toConsentYear(resolveCurrentSchoolYear(years, now)) };
};

const loadCartLines = async (userId: string): Promise<CartLine[]> => (await getCartRepository().findByUserId(userId))?.lines ?? [];

export const getPolicyConsentStatus = async (userId: string): Promise<PolicyConsentStatus> => {
  const { policies, registrationYears, outstanding, currentYear } = await loadConsentState(userId, await loadCartLines(userId), new Date());
  const year = outstanding[0] ?? registrationYears[0] ?? currentYear;
  const required = outstanding.length > 0;
  return {
    required,
    schoolYearId: year.id,
    ...(year.name ? { schoolYearName: year.name } : {}),
    outstandingSchoolYears: outstanding,
    versionHash: policies.versionHash,
    policies: required ? policies.snapshot : [],
  };
};

// Signs for every unsigned year in the cart (or the current year when the cart has no registration).
// Returns only the records it created, so a repeat submission adds nothing.
export const signPolicyConsent = async (userId: string, input: SignPolicyConsentInput): Promise<PolicyConsentEntity[]> => {
  const now = new Date();
  const { policies, registrationYears, signedYearIds, currentYear } = await loadConsentState(userId, await loadCartLines(userId), now);
  if (!policies.hasPolicies) throw ValidationError('There are no studio policies to sign.');
  if (input.versionHash !== policies.versionHash) {
    throw new AppError(409, POLICY_VERSION_CHANGED, 'The studio policies were just updated. Please review them and sign again.');
  }

  const targets = registrationYears.length > 0 ? registrationYears : [currentYear];
  const repository = getPolicyConsentRepository();
  return Promise.all(
    targets
      .filter((year) => !signedYearIds.includes(year.id))
      .map((year) =>
        repository.create({
          userId,
          schoolYearId: year.id,
          ...(year.name ? { schoolYearName: year.name } : {}),
          policyVersionHash: policies.versionHash,
          policySnapshot: policies.snapshot,
          signedName: input.signedName,
          agreedAt: now,
          method: 'online',
          ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
          ...(input.userAgent ? { userAgent: input.userAgent } : {}),
        }),
      ),
  );
};

export const assertPolicyConsent = async (userId: string, lines: CartLine[]): Promise<void> => {
  const { outstanding } = await loadConsentState(userId, lines, new Date());
  if (outstanding.length > 0) {
    throw new AppError(403, POLICY_CONSENT_REQUIRED, 'Please read and sign the studio policies before registering.', {
      outstandingSchoolYears: outstanding,
    });
  }
};

export const listPolicyConsentsForUser = (userId: string): Promise<PolicyConsentEntity[]> => getPolicyConsentRepository().findByUserId(userId);

// The latest signature per school year, without the policy text - what a family sees on their profile.
export const listPolicyConsentSummaries = async (userId: string): Promise<PolicyConsentSummary[]> => {
  const [consents, policies] = await Promise.all([listPolicyConsentsForUser(userId), loadCurrentPolicies()]);
  const latestPerYear = new Map<string | null, PolicyConsentEntity>();
  for (const consent of consents) {
    if (!latestPerYear.has(consent.schoolYearId)) latestPerYear.set(consent.schoolYearId, consent);
  }
  return [...latestPerYear.values()].map((consent) => ({
    id: consent.id,
    schoolYearId: consent.schoolYearId,
    ...(consent.schoolYearName ? { schoolYearName: consent.schoolYearName } : {}),
    agreedAt: consent.agreedAt,
    method: consent.method,
    isCurrentVersion: consent.policyVersionHash === policies.versionHash,
  }));
};

// Staff attesting that a family signed a paper copy of the policies as they stand today.
export const recordPaperPolicyConsent = async (userId: string, input: RecordPaperConsentInput): Promise<PolicyConsentEntity> => {
  const [policies, year] = await Promise.all([loadCurrentPolicies(), getSchoolYearRepository().findById(input.schoolYearId)]);
  if (!year) throw NotFoundError('School year not found');
  if (!policies.hasPolicies) throw ValidationError('There are no studio policies to sign.');
  return getPolicyConsentRepository().create({
    userId,
    schoolYearId: year.id,
    schoolYearName: year.name,
    policyVersionHash: policies.versionHash,
    policySnapshot: policies.snapshot,
    signedName: input.signedName,
    agreedAt: new Date(),
    method: 'paper',
    recordedByUserId: input.recordedByUserId,
    recordedByName: input.recordedByName,
  });
};
