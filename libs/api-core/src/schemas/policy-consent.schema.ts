import { z } from 'zod';

const signedNameSchema = z.string().trim().min(2, 'Enter your full legal name').max(200);

export const signPolicyConsentSchema = z.object({
  versionHash: z.string().min(1),
  signedName: signedNameSchema,
  agreed: z.literal(true),
});

export const recordPaperPolicyConsentSchema = z.object({
  schoolYearId: z.string().min(1),
  signedName: signedNameSchema,
});
