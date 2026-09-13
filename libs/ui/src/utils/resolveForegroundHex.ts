const DARK_FOREGROUND = '#0a0a0a';
const LIGHT_FOREGROUND = '#fafafa';

const expandShorthandHex = (hex: string): string =>
  hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;

// WCAG relative luminance: each sRGB channel is linearized (gamma-decoded) before being weighted -
// the weights approximate human eyes' greater sensitivity to green than red or blue.
const relativeLuminance = (hex: string): number => {
  const full = expandShorthandHex(hex);
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(full.slice(1 + offset, 3 + offset), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (luminanceA: number, luminanceB: number): number => {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
};

// Picks whichever of the two foreground shades already used across the theme (dark #0a0a0a /
// light #fafafa text - see theme.css's *-foreground tokens) gives better WCAG contrast against
// an arbitrary background hex. Used to derive a full -foreground scale for a custom brand color:
// unlike the hand-authored defaults (tuned once against known hexes), an admin-picked color can
// land anywhere in the lightness range, so the dark/light split has to be recomputed per shade
// rather than assumed from a fixed intensity cutoff.
export const resolveForegroundHex = (backgroundHex: string): string => {
  const backgroundLuminance = relativeLuminance(backgroundHex);
  const darkContrast = contrastRatio(backgroundLuminance, relativeLuminance(DARK_FOREGROUND));
  const lightContrast = contrastRatio(backgroundLuminance, relativeLuminance(LIGHT_FOREGROUND));
  return darkContrast >= lightContrast ? DARK_FOREGROUND : LIGHT_FOREGROUND;
};
