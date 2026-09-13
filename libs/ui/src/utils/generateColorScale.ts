import { COLOR_INTENSITIES } from '../contracts/color.contract';
import type { ColorIntensity } from '../contracts/color.contract';

export type ColorScale = Record<ColorIntensity, string>;

interface Hsl {
  readonly h: number;
  readonly s: number;
  readonly l: number;
}

const expandShorthandHex = (hex: string): string =>
  hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;

const hexToHsl = (hex: string): Hsl => {
  const full = expandShorthandHex(hex);
  const r = parseInt(full.slice(1, 3), 16) / 255;
  const g = parseInt(full.slice(3, 5), 16) / 255;
  const b = parseInt(full.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l: l * 100 };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / delta) % 6;
      break;
    case g:
      h = (b - r) / delta + 2;
      break;
    default:
      h = (r - g) / delta + 4;
  }
  h *= 60;
  if (h < 0) h += 360;

  return { h, s: s * 100, l: l * 100 };
};

const hslToHex = ({ h, s, l }: Hsl): string => {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;

  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] :
    [c, 0, x];

  const toChannelHex = (channel: number) =>
    Math.round((channel + m) * 255).toString(16).padStart(2, '0');

  return `#${toChannelHex(r1)}${toChannelHex(g1)}${toChannelHex(b1)}`;
};

const ANCHOR_INTENSITY_INDEX = COLOR_INTENSITIES.indexOf(500);
const LAST_INDEX = COLOR_INTENSITIES.length - 1;
// Lightness targets the scale eases toward at its lightest (100) and darkest (950) stop,
// regardless of the base color's own lightness - keeps every generated scale visibly tinted/
// shaded rather than clipping to true white/black.
const LIGHT_ANCHOR_L = 97;
const DARK_ANCHOR_L = 8;
// How much saturation tapers off at the extreme stops (100 and 950) - a color held at full
// saturation all the way to near-white/near-black reads as neon/muddy rather than a soft tint/
// shade, so this fades saturation out in proportion to distance from the 500 base.
const EXTREME_SATURATION_FALLOFF = 0.5;

// Generates a full 100-950 intensity scale from a single hex color treated as the 500 (base)
// stop - the shape every semantic token in theme.css already has, just derived instead of
// hand-authored. Hue and saturation are held from the base color; only lightness is interpolated
// toward a light anchor (100) or dark anchor (950), so 500 always reproduces the input exactly
// and the rest of the scale reads as tints/shades of the same brand color.
export const generateColorScale = (baseHex: string): ColorScale => {
  const base = hexToHsl(baseHex);
  const scale = {} as Record<ColorIntensity, string>;

  COLOR_INTENSITIES.forEach((intensity, index) => {
    if (index === ANCHOR_INTENSITY_INDEX) {
      scale[intensity] = baseHex;
      return;
    }

    const isLighter = index < ANCHOR_INTENSITY_INDEX;
    const t = isLighter
      ? (ANCHOR_INTENSITY_INDEX - index) / ANCHOR_INTENSITY_INDEX
      : (index - ANCHOR_INTENSITY_INDEX) / (LAST_INDEX - ANCHOR_INTENSITY_INDEX);
    const clampedT = Math.min(Math.max(t, 0), 1);

    const targetL = isLighter ? LIGHT_ANCHOR_L : DARK_ANCHOR_L;
    const l = base.l + (targetL - base.l) * clampedT;
    const s = base.s * (1 - EXTREME_SATURATION_FALLOFF * clampedT);

    scale[intensity] = hslToHex({ h: base.h, s, l: Math.min(Math.max(l, 0), 100) });
  });

  return scale;
};

// Dark-mode surface override in theme.css is the light scale's mirror image around its midpoint
// (100<->950, 200<->900, ..., 500<->600) - this reproduces that same mirroring for a
// custom-generated scale so admin-picked surface colors keep working correctly in both themes.
export const mirrorColorScale = (scale: ColorScale): ColorScale => {
  const reversedIntensities = [...COLOR_INTENSITIES].reverse();
  const mirrored = {} as Record<ColorIntensity, string>;

  COLOR_INTENSITIES.forEach((intensity, index) => {
    mirrored[intensity] = scale[reversedIntensities[index]];
  });

  return mirrored;
};
