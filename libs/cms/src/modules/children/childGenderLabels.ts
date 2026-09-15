import type { ChildGender } from '@inithium/db';

// Hand-mirrored rather than importing @inithium/db's CHILD_GENDERS as a runtime value - every
// existing frontend import from @inithium/db is `import type` only, since @inithium/db's barrel
// also re-exports the Mongo provider and its mongoose-dependent code (see UserFormDialog's own
// identical CORE_ROLES mirror for the same reason). Small, stable literal, kept in sync by hand.
export const CHILD_GENDERS = ['he_him', 'she_her', 'they_them', 'prefer_not_to_say'] as const;

export const CHILD_GENDER_LABELS: Record<ChildGender, string> = {
  he_him: 'He/Him',
  she_her: 'She/Her',
  they_them: 'They/Them',
  prefer_not_to_say: 'Prefer not to say',
};
