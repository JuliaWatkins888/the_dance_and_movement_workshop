import type { ColorSpec, ColorUtilityPrefix } from '../contracts/color.contract';

// A single template covers both semantic tokens (primary, surface-foreground, ...)
// and raw Tailwind palette colors (emerald, amber, ...) because theme.css registers
// the semantic tokens into Tailwind's own `--color-*` namespace at the same shape
// (`--color-{name}-{shade}`) that Tailwind's built-in palette already uses. Tailwind's
// class scanner resolves whichever one exists, so this resolver never needs to know
// which kind of color it was handed.
export const resolveColorClass = (
  prefix: ColorUtilityPrefix,
  spec: ColorSpec | undefined,
): string | undefined => {
  if (!spec) return undefined;

  const shade = spec.intensity !== undefined ? `-${spec.intensity}` : '';
  const alpha = spec.opacity !== undefined ? `/${spec.opacity}` : '';

  return `${prefix}-${spec.color}${shade}${alpha}`;
};
