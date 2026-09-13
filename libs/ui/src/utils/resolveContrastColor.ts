import { isSemanticColorToken } from '../contracts/color.contract';
import type { ColorSpec } from '../contracts/color.contract';

const FALLBACK_CONTRAST_COLOR: ColorSpec = { color: 'surface', intensity: 100 };

// Shared by Switch's thumb, Checkbox's check icon, and RadioGroup's indicator: a semantic
// token (primary, secondary, ...) has a matching "-foreground" token for legible contrast;
// a raw palette color (emerald, blue, ...) has no such pairing, so it falls back to a fixed
// light neutral instead of guessing a contrasting shade.
export const resolveContrastColor = (color: ColorSpec): ColorSpec =>
  isSemanticColorToken(color.color)
    ? { color: `${color.color}-foreground`, intensity: color.intensity, opacity: color.opacity }
    : FALLBACK_CONTRAST_COLOR;
