import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Box, Slider, Tabs, TabsContent, TabsList, TabsTrigger } from '../components';
import { FieldShell } from '../components/FieldShell/FieldShell';
import { mergeClassNames } from '../theme/mergeClassNames';
import { resolveColorClass } from '../theme/resolveColorClass';
import { useElementSize } from './useElementSize';
import { COLOR_INTENSITIES } from '../contracts/color.contract';
import { THEME_SWATCH_COLORS, TAILWIND_SWATCH_COLORS } from '../tokens/colorPicker';
import type { ColorIntensity, ColorSpec } from '../contracts/color.contract';
import type { FieldProps } from '../tokens/field';

export interface ColorSpecPickerProps extends FieldProps {
  readonly value?: ColorSpec;
  readonly defaultValue?: ColorSpec;
  readonly onValueChange?: (spec: ColorSpec) => void;
  readonly name?: string;
  readonly id?: string;
  readonly className?: string;
}

const DEFAULT_SPEC: ColorSpec = { color: 'primary', intensity: 500 };
const DEFAULT_INTENSITY_INDEX = COLOR_INTENSITIES.indexOf(500);
const SWATCH_BORDER_COLOR: ColorSpec = { color: 'surface', intensity: 300 };
// See ColorPicker's identical constant - the swatch panel needs real room for a legible
// 6-column grid + tabs regardless of how narrow its trigger happens to be.
const MIN_PANEL_WIDTH = 260;

const SwatchGrid = ({
  colors,
  intensity,
  onPick,
}: {
  colors: readonly string[];
  intensity: ColorIntensity;
  onPick: (colorName: string, intensity: ColorIntensity) => void;
}) => (
  <div className="grid w-full grid-cols-6 gap-2 mb-3">
    {colors.map((colorName) => (
      <button
        key={colorName}
        type="button"
        onClick={() => onPick(colorName, intensity)}
        aria-label={`${colorName} ${intensity}`}
        title={`${colorName}-${intensity}`}
        className={mergeClassNames(
          'aspect-square w-full rounded border border-surface-300 transition-transform hover:scale-110',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
          resolveColorClass('bg', { color: colorName, intensity }),
        )}
      />
    ))}
  </div>
);

// Sibling to ColorPicker (composites/ColorPicker.tsx), sharing its Theme/More-Colors swatch
// panel almost verbatim, but committing a semantic ColorSpec ({color, intensity}) instead of a
// resolved hex string - built for callers (AvatarEditDialog's bg/text pickers) whose persisted
// value genuinely needs to "adhere to the global color prop" (stay a live semantic token, not a
// frozen hex snapshot), where ColorPicker's own hex output - correct for Banner's trianglify
// colors, which need real interpolatable RGB - wouldn't fit the target type at all. No free-text
// entry here (unlike ColorPicker): a ColorSpec's `color` is a closed token/palette-name enum, not
// an open hex value space, so only swatch clicks can ever produce a valid one.
export const ColorSpecPicker = ({
  label,
  required,
  disabled,
  error,
  helperText,
  value,
  defaultValue,
  onValueChange,
  name,
  id,
  className,
}: ColorSpecPickerProps) => {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const helperTextId = helperText !== undefined ? `${fieldId}-helper` : undefined;

  const [uncontrolledValue, setUncontrolledValue] = useState<ColorSpec>(defaultValue ?? DEFAULT_SPEC);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? (value ?? DEFAULT_SPEC) : uncontrolledValue;

  const [open, setOpen] = useState(false);
  const [themeIntensityIndex, setThemeIntensityIndex] = useState(DEFAULT_INTENSITY_INDEX);
  const [tailwindIntensityIndex, setTailwindIntensityIndex] = useState(DEFAULT_INTENSITY_INDEX);

  const containerRef = useRef<HTMLDivElement>(null);
  const { ref: sizeRef, size } = useElementSize();
  const panelWidth = Math.max(size?.width ?? MIN_PANEL_WIDTH, MIN_PANEL_WIDTH);
  // A *stable* merged ref - see ColorPicker's identical fix/comment. An inline `ref={(node) =>
  // {...}}` here is a new function identity every render, which makes React detach+reattach the
  // ref (re-firing sizeRef's own setState) on every render - an infinite update loop.
  const mergedContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      sizeRef(node);
    },
    [sizeRef],
  );

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const commit = (spec: ColorSpec) => {
    if (!isControlled) setUncontrolledValue(spec);
    onValueChange?.(spec);
    setOpen(false);
  };

  const themeIntensity = COLOR_INTENSITIES[themeIntensityIndex]!;
  const tailwindIntensity = COLOR_INTENSITIES[tailwindIntensityIndex]!;

  return (
    <FieldShell
      label={label}
      required={required}
      error={error}
      helperText={helperText}
      helperTextId={helperTextId}
      htmlFor={fieldId}
      className={className}
    >
      <div ref={mergedContainerRef} className="relative w-full">
        <button
          type="button"
          id={fieldId}
          name={name}
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-describedby={helperTextId}
          className={mergeClassNames(
            'flex h-10 w-full items-center gap-2 rounded-md border bg-transparent px-3 text-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error ? 'border-red-500' : 'border-surface-300',
          )}
        >
          <Box bgColor={currentValue} borderColor={SWATCH_BORDER_COLOR} className="h-5 w-5 shrink-0 rounded border" />
          <span className="text-surface-900">
            {currentValue.color}-{currentValue.intensity ?? 500}
          </span>
        </button>

        {open && !disabled && (
          <Box
            bgColor={{ color: 'surface', intensity: 100 }}
            borderColor={SWATCH_BORDER_COLOR}
            padding={{ base: 12 }}
            style={{ width: `${panelWidth}px` }}
            className="absolute left-0 top-full z-50 mt-1 rounded-md border shadow-lg"
          >
            <Tabs defaultValue="theme">
              <TabsList>
                <TabsTrigger value="theme">Theme</TabsTrigger>
                <TabsTrigger value="more">More Colors</TabsTrigger>
              </TabsList>

              <TabsContent value="theme">
                <SwatchGrid
                  colors={THEME_SWATCH_COLORS}
                  intensity={themeIntensity}
                  onPick={(color, intensity) => commit({ color, intensity })}
                />
                <Slider
                  label={`Intensity — ${themeIntensity}`}
                  min={0}
                  max={COLOR_INTENSITIES.length - 1}
                  step={1}
                  value={[themeIntensityIndex]}
                  onValueChange={([index]) => setThemeIntensityIndex(index!)}
                  className="mt-3"
                />
              </TabsContent>

              <TabsContent value="more">
                <SwatchGrid
                  colors={TAILWIND_SWATCH_COLORS}
                  intensity={tailwindIntensity}
                  onPick={(color, intensity) => commit({ color, intensity })}
                />
                <Slider
                  label={`Intensity — ${tailwindIntensity}`}
                  min={0}
                  max={COLOR_INTENSITIES.length - 1}
                  step={1}
                  value={[tailwindIntensityIndex]}
                  onValueChange={([index]) => setTailwindIntensityIndex(index!)}
                  className="mt-3"
                />
              </TabsContent>
            </Tabs>
          </Box>
        )}
      </div>
    </FieldShell>
  );
};
