import { generateSeededBannerConfig } from '@inithium/ui';
import type { BannerTrianglifyConfig } from '@inithium/ui';

// A different default Trianglify mesh per user who hasn't customized their own yet - seeded from
// the profile's own id so the same profile renders the same mesh on every visit, and nothing
// needs to be written to the DB until a user actually saves a custom banner.
export const generateProfileBannerConfig = (seed: string): BannerTrianglifyConfig => generateSeededBannerConfig(seed);
