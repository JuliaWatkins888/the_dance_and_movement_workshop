import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Box, Input, Slider, Tabs, TabsContent, TabsList, TabsTrigger } from '../components';
import { FieldShell } from '../components/FieldShell/FieldShell';
import { mergeClassNames } from '../theme/mergeClassNames';
import { resolveColorClass } from '../theme/resolveColorClass';
import { resolveComputedColorHex } from '../utils/resolveComputedColorHex';
import { useElementSize } from './useElementSize';
import { COLOR_INTENSITIES } from '../contracts/color.contract';
import { THEME_SWATCH_COLORS, TAILWIND_SWATCH_COLORS } from '../tokens/colorPicker';
import type { ColorIntensity, ColorSpec } from '../contracts/color.contract';
import type { FieldProps } from '../tokens/field';

export interface ColorPickerProps extends FieldProps {
  readonly color?: ColorSpec;
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (hex: string) => void;
  readonly placeholder?: string;
  readonly name?: string;
  readonly id?: string;
  readonly className?: string;
}

const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DEFAULT_INTENSITY_INDEX = COLOR_INTENSITIES.indexOf(500);
const NEUTRAL_SWATCH_COLOR: ColorSpec = { color: 'surface', intensity: 200 };
const SWATCH_BORDER_COLOR: ColorSpec = { color: 'surface', intensity: 300 };
// The swatch panel below needs real room for a legible 6-column grid + tabs regardless of how
// narrow its trigger happens to be (e.g. one cell of an AutoIncrementingList column) - matching
// the trigger's own width via a plain CSS `w-full` only works reliably when that width is
// already generous, so the panel's real width is measured instead (see useElementSize) and
// widened up to this floor rather than trusted to inherit correctly through an arbitrary
// flex/absolute-positioning ancestor chain.
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
  // grid-cols-6 with each swatch stretched to `w-full` (rather than a fixed size) spans the
  // full row width with even gap-driven spacing regardless of container width - see
  // THEME_SWATCH_COLORS, sized to exactly six entries so its one row always fills completely.
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

// Composes Input (the hex text field, adorned with a swatch preview "button") + Box (the
// swatch preview and the picker panel) + Tabs + Slider into a color field that cooperates with
// this package's theming engine: pick a semantic token (Theme tab) or any Tailwind palette
// color (More Colors tab) at any of the ten shade stops, and the swatch resolves to a concrete
// hex string via resolveComputedColorHex rather than a hardcoded value, so it always reflects
// whatever the consuming app's current theme actually renders (see theme/theme.css).
//
// `value`/`defaultValue`/`onValueChange` follow the same controlled/uncontrolled string
// contract as Select (see components/Select/Select.tsx): onValueChange mirrors the field's
// current text on every keystroke, valid or not, the same way a native onChange would - typing
// an incomplete hex like "#1" is never blocked or reverted. Only a value that currently matches
// HEX_PATTERN drives the swatch preview's actual color.
export const ColorPicker = ({
  label,
  required,
  disabled,
  error,
  helperText,
  color,
  value,
  defaultValue,
  onValueChange,
  placeholder = '#000000',
  name,
  id,
  className,
}: ColorPickerProps) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helperTextId = helperText !== undefined ? `${inputId}-helper` : undefined;

  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? '');
  const isControlled = value !== undefined;
  const currentValue = isControlled ? (value ?? '') : uncontrolledValue;

  const [open, setOpen] = useState(false);
  const [themeIntensityIndex, setThemeIntensityIndex] = useState(DEFAULT_INTENSITY_INDEX);
  const [tailwindIntensityIndex, setTailwindIntensityIndex] = useState(DEFAULT_INTENSITY_INDEX);

  const containerRef = useRef<HTMLDivElement>(null);
  const { ref: sizeRef, size } = useElementSize();
  const panelWidth = Math.max(size?.width ?? MIN_PANEL_WIDTH, MIN_PANEL_WIDTH);
  // A *stable* merged ref, not a fresh inline function each render - sizeRef's own attach
  // handler calls setSize (see useElementSize.ts), and an inline `ref={(node) => {...}}` is a
  // new function identity every render, which makes React detach+reattach the ref (and so
  // re-fire that setState) on every single render, an infinite "Maximum update depth exceeded"
  // loop. useCallback keeps this one identity for the component's lifetime since sizeRef itself
  // is already stable (useElementSize memoizes it with never-changing deps).
  const mergedContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      sizeRef(node);
    },
    [sizeRef],
  );

  // Closes on outside pointerdown/Escape rather than input blur, since blur would fire (and
  // close the panel) the moment a user clicks a swatch or drags a slider thumb inside it.
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

  const commit = (next: string) => {
    if (!isControlled) setUncontrolledValue(next);
    onValueChange?.(next);
  };

  const pickSwatch = (colorName: string, intensity: ColorIntensity) => {
    const hex = resolveComputedColorHex(`--color-${colorName}-${intensity}`);
    if (hex) commit(hex);
    setOpen(false);
  };

  const isValidHex = HEX_PATTERN.test(currentValue.trim());
  const themeIntensity = COLOR_INTENSITIES[themeIntensityIndex];
  const tailwindIntensity = COLOR_INTENSITIES[tailwindIntensityIndex];

  return (
    <FieldShell
      label={label}
      required={required}
      error={error}
      helperText={helperText}
      helperTextId={helperTextId}
      htmlFor={inputId}
      className={className}
    >
      <div ref={mergedContainerRef} className="relative w-full">
        <Input
          id={inputId}
          name={name}
          value={currentValue}
          onChange={(event) => commit(event.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          error={error}
          color={color}
          autoComplete="off"
          spellCheck={false}
          className="h-10 pr-11"
          aria-describedby={helperTextId}
        />

        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Choose a color"
          aria-expanded={open}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed"
        >
          <Box
            style={{ backgroundColor: isValidHex ? currentValue : undefined }}
            bgColor={isValidHex ? undefined : NEUTRAL_SWATCH_COLOR}
            borderColor={SWATCH_BORDER_COLOR}
            className="h-5 w-5 rounded border"
          />
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
                <SwatchGrid colors={THEME_SWATCH_COLORS} intensity={themeIntensity} onPick={pickSwatch} />
                <Slider
                  label={`Intensity — ${themeIntensity}`}
                  min={0}
                  max={COLOR_INTENSITIES.length - 1}
                  step={1}
                  value={[themeIntensityIndex]}
                  onValueChange={([index]) => setThemeIntensityIndex(index)}
                  color={color}
                  className="mt-3"
                />
              </TabsContent>

              <TabsContent value="more">
                <SwatchGrid colors={TAILWIND_SWATCH_COLORS} intensity={tailwindIntensity} onPick={pickSwatch} />
                <Slider
                  label={`Intensity — ${tailwindIntensity}`}
                  min={0}
                  max={COLOR_INTENSITIES.length - 1}
                  step={1}
                  value={[tailwindIntensityIndex]}
                  onValueChange={([index]) => setTailwindIntensityIndex(index)}
                  color={color}
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
