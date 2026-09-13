const parseHexColor = (hex: string): readonly [number, number, number] => {
  const normalized = hex.replace('#', '');
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((channel) => channel + channel)
          .join('')
      : normalized;
  const value = parseInt(expanded, 16);

  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const formatHexColor = ([r, g, b]: readonly [number, number, number]): string =>
  `#${[r, g, b]
    .map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, '0'))
    .join('')}`;

// Plain linear RGB interpolation between two hex colors. The real trianglify algorithm
// interpolates through Lab color space for perceptual smoothness, but a straight RGB lerp is a
// fair, much simpler approximation for the handful of gradient stops a banner blends between -
// see generateTrianglifyMesh.ts's own comment on that trade-off.
export const mixHexColors = (from: string, to: string, t: number): string => {
  const [r1, g1, b1] = parseHexColor(from);
  const [r2, g2, b2] = parseHexColor(to);

  return formatHexColor([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t]);
};

// Samples a position `t` (0-1) along a multi-stop gradient defined by an ordered color array -
// a single-color array just returns that color regardless of `t`.
export const resolveGradientColor = (colors: readonly [string, ...string[]], t: number): string => {
  if (colors.length === 1) return colors[0];

  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));

  return mixHexColors(colors[index]!, colors[index + 1]!, scaled - index);
};
