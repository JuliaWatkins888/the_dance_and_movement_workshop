import { resolveColorClass } from '../theme/resolveColorClass';
import type { ColorSpec } from '../contracts/color.contract';

export interface FieldColorClasses {
  readonly border: string;
  readonly focusRing: string;
}

const DEFAULT_BORDER_COLOR: ColorSpec = { color: 'surface', intensity: 300 };
const DEFAULT_RING_COLOR: ColorSpec = { color: 'primary', intensity: 500 };
const ERROR_COLOR: ColorSpec = { color: 'red', intensity: 500 };

// Shared by Input, Select, and Textarea: `color` drives both the border and the
// focus-visible ring at whatever intensity the caller supplies; `error` overrides both to
// a fixed red-500 regardless of `color`, and an unset `color` falls back to a neutral
// surface border with a primary focus ring rather than leaving the control unstyled.
export const resolveFieldColorClasses = (
  color: ColorSpec | undefined,
  error: boolean | undefined,
): FieldColorClasses => {
  const borderColor = error ? ERROR_COLOR : (color ?? DEFAULT_BORDER_COLOR);
  const ringColor = error ? ERROR_COLOR : (color ?? DEFAULT_RING_COLOR);

  return {
    border: resolveColorClass('border', borderColor) as string,
    focusRing: `focus-visible:${resolveColorClass('ring', ringColor)}`,
  };
};
