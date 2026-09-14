import type { PolicySeedCategory } from './dance-studio-policies.seed';
import { policySeeds as danceStudioPolicySeeds } from './dance-studio-policies.seed';

// Unlike page-seeds/registry.ts and settings-seeds/registry.ts, there's exactly one seed source
// here (the studio's own ported policy content) rather than multiple plugins each contributing
// their own entries, so this stays a single array rather than an inithium-block merge point.
export const policySeeds: PolicySeedCategory[] = danceStudioPolicySeeds;
