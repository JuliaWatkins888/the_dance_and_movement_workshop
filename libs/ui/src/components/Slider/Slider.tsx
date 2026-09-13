import { forwardRef, useId } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { resolveColorClass } from '../../theme/resolveColorClass';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveFieldColorClasses } from '../../utils/resolveFieldColorClasses';
import { FieldShell } from '../FieldShell/FieldShell';
import type { ColorSpec } from '../../contracts/color.contract';
import type { FieldProps } from '../../tokens/field';

export interface SliderProps extends FieldProps {
  readonly color?: ColorSpec;
  readonly value?: number[];
  readonly defaultValue?: number[];
  readonly onValueChange?: (value: number[]) => void;
  readonly onValueCommit?: (value: number[]) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly name?: string;
  readonly id?: string;
  readonly className?: string;
}

const DEFAULT_RANGE_COLOR: ColorSpec = { color: 'primary', intensity: 500 };
const ERROR_COLOR: ColorSpec = { color: 'red', intensity: 500 };

// `color` paints only the filled Range (values at or below the current position); the
// unfilled Track stays bg-surface-200 regardless. Thumb/Root are span-based (no native
// `disabled`/labelable semantics), so disabled styling keys off Radix's `data-disabled`
// attribute and the label associates via aria-labelledby instead of htmlFor.
export const Slider = forwardRef<HTMLSpanElement, SliderProps>(
  (
    {
      label,
      required,
      disabled,
      error,
      helperText,
      color,
      value,
      defaultValue,
      onValueChange,
      onValueCommit,
      min,
      max,
      step,
      name,
      id,
      className,
    },
    ref,
  ) => {
    const autoId = useId();
    const sliderId = id ?? autoId;
    const labelId = `${sliderId}-label`;
    const helperTextId = helperText !== undefined ? `${sliderId}-helper` : undefined;

    const rangeColor = error ? ERROR_COLOR : (color ?? DEFAULT_RANGE_COLOR);
    const rangeColorClass = resolveColorClass('bg', rangeColor);
    const { border: thumbBorder, focusRing: thumbFocusRing } = resolveFieldColorClasses(color, error);

    const thumbCount = (value ?? defaultValue)?.length ?? 1;

    const rootClasses = mergeClassNames(
      'relative flex w-full touch-none select-none items-center py-2',
      'data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed',
      className,
    );

    const thumbClasses = mergeClassNames(
      'block h-4 w-4 rounded-full border bg-surface-100 shadow-sm transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
      thumbBorder,
      thumbFocusRing,
    );

    return (
      <FieldShell
        label={label}
        labelId={label ? labelId : undefined}
        required={required}
        error={error}
        helperText={helperText}
        helperTextId={helperTextId}
      >
        <SliderPrimitive.Root
          ref={ref}
          id={sliderId}
          value={value}
          defaultValue={defaultValue}
          onValueChange={onValueChange}
          onValueCommit={onValueCommit}
          min={min}
          max={max}
          step={step}
          name={name}
          disabled={disabled}
          className={rootClasses}
        >
          <SliderPrimitive.Track className="relative h-1.5 w-full grow rounded-full bg-surface-200">
            <SliderPrimitive.Range className={mergeClassNames('absolute h-full rounded-full', rangeColorClass)} />
          </SliderPrimitive.Track>
          {Array.from({ length: thumbCount }, (_, index) => (
            <SliderPrimitive.Thumb
              key={index}
              aria-labelledby={label ? labelId : undefined}
              aria-invalid={error || undefined}
              aria-describedby={helperTextId}
              className={thumbClasses}
            />
          ))}
        </SliderPrimitive.Root>
      </FieldShell>
    );
  },
);

Slider.displayName = 'Slider';
