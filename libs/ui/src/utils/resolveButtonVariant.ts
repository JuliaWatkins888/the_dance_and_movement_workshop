import { isSemanticColorToken, type ColorSpec } from '../contracts/color.contract';
import type { SpacingProp } from '../tokens/spacing';
import type { ButtonVariantSpec } from '../tokens/button';

export interface ButtonVariantDefaults {
  readonly bgColor?: ColorSpec;
  readonly textColor?: ColorSpec;
  readonly borderColor?: ColorSpec;
  readonly padding: SpacingProp;
  readonly className: string;
}

const DEFAULT_INTENSITY = 500;
const NEUTRAL_TEXT_COLOR: ColorSpec = { color: 'slate', intensity: 500 };
// red-500 specifically reads better with a near-white label than the general slate-500 fallback
// below (e.g. destructive confirm buttons) - carved out ahead of that fallback rather than
// replacing it, so every other raw color/intensity combination keeps today's slate-500 text.
const RED_500_TEXT_COLOR: ColorSpec = { color: 'slate', intensity: 100 };

const STANDARD_PADDING: SpacingProp = { top: 5, right: 15, bottom: 5, left: 15 };
const LINK_PADDING: SpacingProp = { top: 4, bottom: 4 };

const NEUTRAL_CLASSES = 'rounded transition-all cursor-pointer';

// Hover classes are built from the variant's own `color` at a FIXED shade (500 or 100)
// rather than the caller's chosen `intensity` - keeps the dynamic surface small enough that
// theme.css only safelists two shades per family under a hover: prefix (see its
// resolveButtonVariant @source inline(...) block) instead of the full 100-950 range.
const filledHoverText = (color: string) => `hover:text-${color}-${DEFAULT_INTENSITY}`;
const tintedHoverBg = (color: string) => `hover:bg-${color}-100`;
const linkHoverBorder = (color: string) => `hover:border-b-${color}-${DEFAULT_INTENSITY}`;

// Maps a { kind, color, intensity } spec onto the baseline bgColor/textColor/borderColor,
// padding, and structural+hover classes for that visual style. Button.tsx lets any explicit
// bgColor/textColor/borderColor/padding prop override the corresponding field here - this
// resolver only ever produces defaults, never the final answer.
export const resolveButtonVariant = (spec: ButtonVariantSpec | undefined): ButtonVariantDefaults => {
  if (!spec) {
    return { padding: STANDARD_PADDING, className: NEUTRAL_CLASSES };
  }

  const { kind, color, opacity } = spec;
  const intensity = spec.intensity ?? DEFAULT_INTENSITY;
  const colorSpec: ColorSpec = { color, intensity, opacity };

  switch (kind) {
    case 'filled': {
      // Semantic tokens (primary, secondary, ...) pair with their own `-foreground` token
      // for legible text; raw palette colors (red, emerald, ...) have no such pairing, so
      // they fall back to a fixed light neutral instead of guessing a contrasting shade -
      // except red at its default intensity (500), which gets its own lighter override above.
      const textColor: ColorSpec = isSemanticColorToken(color)
        ? { color: `${color}-foreground`, intensity, opacity }
        : color === 'red' && intensity === DEFAULT_INTENSITY
          ? RED_500_TEXT_COLOR
          : NEUTRAL_TEXT_COLOR;

      return {
        bgColor: colorSpec,
        borderColor: colorSpec,
        textColor,
        padding: STANDARD_PADDING,
        className: `border-2 rounded transition-all cursor-pointer hover:bg-slate-100 ${filledHoverText(color)}`,
      };
    }
    case 'outlined':
      return {
        bgColor: NEUTRAL_TEXT_COLOR,
        borderColor: colorSpec,
        textColor: colorSpec,
        padding: STANDARD_PADDING,
        className: `border-2 rounded transition-all cursor-pointer ${tintedHoverBg(color)}`,
      };
    case 'ghost':
      return {
        textColor: colorSpec,
        padding: STANDARD_PADDING,
        className: `rounded transition-all cursor-pointer ${tintedHoverBg(color)}`,
      };
    case 'link':
      return {
        textColor: colorSpec,
        padding: LINK_PADDING,
        className: `border-b-2 border-b-transparent transition-all cursor-pointer ${linkHoverBorder(color)}`,
      };
  }
};
