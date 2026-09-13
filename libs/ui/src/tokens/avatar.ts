import type { ColorSpec } from '../contracts/color.contract';

export const AVATAR_SHAPES = ['circle', 'square'] as const;
export type AvatarShape = (typeof AVATAR_SHAPES)[number];

export const AVATAR_VARIANTS = ['initials', 'dicebear'] as const;
export type AvatarVariant = (typeof AVATAR_VARIANTS)[number];

// The full DiceBear 9.x style catalog (https://api.dicebear.com/9.x) minus its own "initials"
// style - that style would read as a confusing duplicate of this package's own 'initials'
// AvatarVariant (a completely different, non-DiceBear rendering path) sitting right next to it
// in the same picker. Order here is the display order AvatarEditDialog renders these in.
export const DICEBEAR_STYLES = [
  'adventurer',
  'adventurer-neutral',
  'avataaars',
  'avataaars-neutral',
  'big-ears',
  'big-ears-neutral',
  'big-smile',
  'bottts',
  'bottts-neutral',
  'croodles',
  'croodles-neutral',
  'dylan',
  'fun-emoji',
  'glass',
  'icons',
  'identicon',
  'lorelei',
  'lorelei-neutral',
  'micah',
  'miniavs',
  'notionists',
  'notionists-neutral',
  'open-peeps',
  'personas',
  'pixel-art',
  'pixel-art-neutral',
  'rings',
  'shapes',
  'thumbs',
] as const;
export type DicebearStyle = (typeof DICEBEAR_STYLES)[number];

// "big-ears-neutral" -> "Big Ears Neutral" - used to label each style's picker button without a
// hand-maintained name map that could drift from the slug list above.
export const humanizeDicebearStyle = (style: string): string =>
  style
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

// bgColor/fontColor reuse ColorSpec (see contracts/color.contract.ts) rather than raw strings,
// the same semantic-token-or-palette-color contract every other colorable prop in this package
// (Box, Text, Button, ...) already uses.
export interface AvatarStyleConfig {
  readonly bgColor?: ColorSpec;
  readonly fontColor?: ColorSpec;
  readonly shape?: AvatarShape;
}

export interface AvatarInitialsSource {
  readonly variant: 'initials';
  readonly name: string;
}

// Wired up to the DiceBear picker in AvatarEditDialog - style is one of DICEBEAR_STYLES, seed is
// whatever string the picker's arrow-cycling history landed on, and options passes that style's
// own optional query params (backgroundColor, radius, ...) straight through.
export interface AvatarDicebearSource {
  readonly variant: 'dicebear';
  readonly style: string;
  readonly seed: string;
  readonly options?: Record<string, string | number | boolean>;
  readonly alt?: string;
}

export type AvatarSource = AvatarInitialsSource | AvatarDicebearSource;

export const DEFAULT_AVATAR_STYLE: Required<Pick<AvatarStyleConfig, 'bgColor' | 'shape'>> = {
  bgColor: { color: 'primary', intensity: 500 },
  shape: 'circle',
};

// Mirrors @inithium/realtime's PresenceStatus (contracts/presence.contract.ts) at the exact
// same string-union shape - the same "duplicate the shape, not the import" choice this file
// already makes for AvatarStyleConfig vs @inithium/db's own color shape: Avatar must stay
// ignorant of any backend/transport package, so a caller wiring live presence into `status`
// passes the string straight through with no translation layer.
export const PRESENCE_STATUSES = ['online', 'busy', 'away', 'offline'] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

export const PRESENCE_STATUS_COLOR: Record<PresenceStatus, ColorSpec> = {
  online: { color: 'emerald', intensity: 500 },
  busy: { color: 'red', intensity: 500 },
  away: { color: 'amber', intensity: 500 },
  offline: { color: 'surface', intensity: 400 },
};
