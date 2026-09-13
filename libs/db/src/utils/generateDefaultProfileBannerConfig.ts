import type { UserProfileBannerConfig } from '../contracts/user.contract';

// A best-effort snapshot of this template's own default theme.css brand hex values, at a few
// intensities each - libs/db has no access to a browser's live CSS custom properties (the only
// way the frontend actually resolves theme colors, see @inithium/ui's resolveComputedColorHex),
// so a truly "on brand" random pick isn't possible from the server. This just gives a freshly
// registered user a pleasant, on-brand-ish starting point; the banner editor's own color pickers
// (frontend, live theme-aware) are how they actually repaint it afterwards.
const DEFAULT_BRAND_HEX_PALETTE = [
  '#8ccce1', '#006a8e', '#004a66', // primary 300/500/700
  '#a5d3d4', '#397e7f', '#235758', // secondary 300/500/700
  '#fbd18d', '#f5a42d', '#b36b13', // accent 300/500/700
  '#c0c7d2', '#64748b', '#485464', // tertiary 300/500/700
  '#94accd', '#25374f', '#1b2839', // quaternary 300/500/700
] as const;

const MIN_CELL_SIZE = 10;
const MAX_CELL_SIZE = 100;
const MIN_VARIANCE = 0.1;
const MAX_VARIANCE = 0.9;

const randomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

const pickRandomHex = (): string => DEFAULT_BRAND_HEX_PALETTE[randomInt(0, DEFAULT_BRAND_HEX_PALETTE.length - 1)]!;

const pickColorStops = (): string[] => Array.from({ length: 2 + randomInt(0, 1) }, pickRandomHex);

// Called once at user-creation time (see user.repository.ts's create(), the same place
// DEFAULT_AVATAR_CONFIG already backfills a missing avatar) so every new user has an immediate,
// customizable baseline banner rather than waiting on a lazy client-side fallback.
export const generateDefaultProfileBannerConfig = (): UserProfileBannerConfig => ({
  cellSize: randomInt(MIN_CELL_SIZE, MAX_CELL_SIZE),
  variance: Math.round((MIN_VARIANCE + Math.random() * (MAX_VARIANCE - MIN_VARIANCE)) * 100) / 100,
  xColors: pickColorStops(),
  yColors: pickColorStops(),
});
