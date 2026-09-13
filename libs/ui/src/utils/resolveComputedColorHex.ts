// ColorPicker needs a concrete "#rrggbb" string to drop into its text input once a theme or
// Tailwind swatch is picked, but every color this package resolves - semantic tokens *and*
// Tailwind's own default palette - is registered as a CSS custom property under Tailwind v4's
// `--color-*` namespace (see theme/theme.css), and Tailwind v4 defines its palette in oklch(),
// not hex. Rather than shipping an oklch->sRGB conversion (or a color library) to decode that
// ourselves, this lets the browser do it: painting the computed custom property's value onto a
// 1x1 canvas and reading the pixel back always yields sRGB, regardless of which color function
// (oklch, a semantic token's plain hex, or anything else a consuming app's theme override uses)
// was actually behind the variable.
export const resolveComputedColorHex = (cssVariable: string): string | undefined => {
  if (typeof document === 'undefined') return undefined;

  const rawColor = getComputedStyle(document.documentElement).getPropertyValue(cssVariable).trim();
  if (!rawColor) return undefined;

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d');
  if (!context) return undefined;

  context.fillStyle = rawColor;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;

  const toHexChannel = (channel: number) => channel.toString(16).padStart(2, '0');
  return `#${toHexChannel(red)}${toHexChannel(green)}${toHexChannel(blue)}`;
};
