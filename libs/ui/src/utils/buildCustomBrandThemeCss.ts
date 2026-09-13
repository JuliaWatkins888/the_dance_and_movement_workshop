import { COLOR_INTENSITIES } from '../contracts/color.contract';
import { generateColorScale, mirrorColorScale } from './generateColorScale';
import { resolveForegroundHex } from './resolveForegroundHex';

// The 5 raw brand tokens that stay fixed across light/dark mode (see theme.css) - each gets a
// derived 100-950 scale plus its paired -foreground scale, both written into a single un-scoped
// `:root` block. `surface` is handled separately below since it's the one token dark mode flips.
const FIXED_BRAND_KEYS = ['primary', 'secondary', 'tertiary', 'quaternary', 'accent'] as const;
type FixedBrandKey = (typeof FIXED_BRAND_KEYS)[number];

export type CustomBrandColors = {
  readonly [K in FixedBrandKey]?: string;
} & {
  readonly surface?: string;
};

// Emits one token's full scale (base + foreground, both at every intensity) as CSS custom
// property declarations, keyed off the same `--ui-*` names theme.css defines statically.
const emitTokenDeclarations = (token: string, baseHex: string, declarations: string[]): void => {
  const scale = generateColorScale(baseHex);
  for (const intensity of COLOR_INTENSITIES) {
    declarations.push(`--ui-${token}-${intensity}: ${scale[intensity]};`);
    declarations.push(`--ui-${token}-foreground-${intensity}: ${resolveForegroundHex(scale[intensity])};`);
  }
};

// Turns an admin's custom brand hex values (from the CMS's "Appearance" settings, one -500 hex
// per token) into a CSS string that overrides theme.css's static --ui-* defaults - only for the
// tokens actually customized, so an admin who sets just `primary` leaves every other token on its
// theme.css default. Pure string generation, no DOM access, so it's equally usable from a
// useEffect-driven <style> tag (see apps/web's RootRouter) or a server-rendered <style> tag.
//
// `surface` needs its own block: theme.css flips *only* the surface/surface-foreground scale
// under `:root[data-theme='dark']` (mirrored around its midpoint - see mirrorColorScale), while
// the 5 raw brand colors are deliberately identical in both themes. Reproducing that split here
// is what keeps a custom surface color correct in dark mode instead of freezing it to one theme's
// values regardless of `data-theme`.
export const buildCustomBrandThemeCss = (colors: CustomBrandColors): string => {
  const rootDeclarations: string[] = [];
  const darkDeclarations: string[] = [];

  for (const token of FIXED_BRAND_KEYS) {
    const hex = colors[token];
    if (hex) emitTokenDeclarations(token, hex, rootDeclarations);
  }

  if (colors.surface) {
    const lightScale = generateColorScale(colors.surface);
    const darkScale = mirrorColorScale(lightScale);
    for (const intensity of COLOR_INTENSITIES) {
      rootDeclarations.push(`--ui-surface-${intensity}: ${lightScale[intensity]};`);
      rootDeclarations.push(`--ui-surface-foreground-${intensity}: ${resolveForegroundHex(lightScale[intensity])};`);
      darkDeclarations.push(`--ui-surface-${intensity}: ${darkScale[intensity]};`);
      darkDeclarations.push(`--ui-surface-foreground-${intensity}: ${resolveForegroundHex(darkScale[intensity])};`);
    }
  }

  if (rootDeclarations.length === 0) return '';

  const rootBlock = `:root {\n  ${rootDeclarations.join('\n  ')}\n}`;
  const darkBlock = darkDeclarations.length > 0
    ? `\n:root[data-theme='dark'] {\n  ${darkDeclarations.join('\n  ')}\n}`
    : '';

  return `${rootBlock}${darkBlock}`;
};
