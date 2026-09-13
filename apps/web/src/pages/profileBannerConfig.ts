import { createSeededRandom, resolveComputedColorHex, resolveStringHash } from '@inithium/ui';
import type { BannerTrianglifyConfig } from '@inithium/ui';

// This app's own brand tokens, not arbitrary hex - keeps every generated mesh on-brand no matter
// which combination gets picked, and theme-override-aware since resolveComputedColorHex reads
// whatever these CSS variables currently resolve to (see theme/theme.css). Mirrors
// blogBannerConfig.ts's own token/intensity pools exactly.
const BRAND_COLOR_TOKENS = ['primary', 'secondary', 'accent', 'tertiary', 'quaternary', 'surface'] as const;
const COLOR_INTENSITIES = [100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const FALLBACK_HEX = '#94a3b8';

const pickBrandHex = (random: () => number): string => {
  const token = BRAND_COLOR_TOKENS[Math.floor(random() * BRAND_COLOR_TOKENS.length)];
  const intensity = COLOR_INTENSITIES[Math.floor(random() * COLOR_INTENSITIES.length)];
  return resolveComputedColorHex(`--color-${token}-${intensity}`) ?? FALLBACK_HEX;
};

const pickColorStops = (random: () => number): [string, ...string[]] => {
  const count = 2 + Math.floor(random() * 2); // 2 or 3 gradient stops
  const stops = Array.from({ length: count }, () => pickBrandHex(random));
  return stops as [string, ...string[]];
};

// A different default Trianglify mesh per user who hasn't customized their own yet - seeded from
// the profile's own id (the same createSeededRandom/resolveStringHash pair
// blogBannerConfig.ts's generateBlogBannerConfig uses) so the same profile renders the same mesh
// on every visit, distinct users render visibly distinct ones, and nothing needs to be written
// to the DB until a user actually saves a custom banner.
export const generateProfileBannerConfig = (seed: string): BannerTrianglifyConfig => {
  const random = createSeededRandom(resolveStringHash(seed));
  return {
    cellSize: 20 + Math.floor(random() * 61), // 20-80
    variance: 0.1 + random() * 0.9, // 0.1-1.0
    xColors: pickColorStops(random),
    yColors: pickColorStops(random),
  };
};
