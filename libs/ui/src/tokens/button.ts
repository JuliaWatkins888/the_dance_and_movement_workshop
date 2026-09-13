import type { ColorSpec } from '../contracts/color.contract';

export const BUTTON_VARIANT_KINDS = ['filled', 'outlined', 'ghost', 'link'] as const;
export type ButtonVariantKind = (typeof BUTTON_VARIANT_KINDS)[number];

// Extends ColorSpec (rather than redeclaring `color`/`intensity`) so a variant's shade is
// constrained to the same ColorIntensity union every other color prop uses - an arbitrary
// `intensity: number` could ask for a shade Tailwind doesn't ship (and theme.css's safelist
// doesn't cover), silently rendering unstyled.
export interface ButtonVariantSpec extends ColorSpec {
  readonly kind: ButtonVariantKind;
}
