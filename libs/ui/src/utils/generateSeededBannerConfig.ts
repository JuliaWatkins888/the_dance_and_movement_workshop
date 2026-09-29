import { createSeededRandom } from './createSeededRandom';
import { resolveComputedColorHex } from './resolveComputedColorHex';
import { resolveStringHash } from './resolveStringHash';
import type { BannerTrianglifyConfig } from '../tokens/banner';

// Brand tokens rather than arbitrary hex, so every generated mesh stays on-brand and follows
// any theme override (resolveComputedColorHex reads whatever the CSS variables resolve to now).
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
  return Array.from({ length: count }, () => pickBrandHex(random)) as [string, ...string[]];
};

// A stable default Trianglify mesh per seed (typically a record id): the same seed renders the
// same mesh on every visit, distinct seeds render visibly distinct ones, and nothing needs to be
// stored until someone saves a custom banner.
export const generateSeededBannerConfig = (seed: string): BannerTrianglifyConfig => {
  const random = createSeededRandom(resolveStringHash(seed));
  return {
    cellSize: 20 + Math.floor(random() * 61), // 20-80
    variance: 0.1 + random() * 0.9, // 0.1-1.0
    xColors: pickColorStops(random),
    yColors: pickColorStops(random),
  };
};
