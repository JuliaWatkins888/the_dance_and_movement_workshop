import { forwardRef, useId } from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { resolveColorClass } from '../../theme/resolveColorClass';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveContrastColor } from '../../utils/resolveContrastColor';
import { FieldShell } from '../FieldShell/FieldShell';
import { Icon } from '../Icon/Icon';
import type { ColorSpec } from '../../contracts/color.contract';
import type { FieldProps } from '../../tokens/field';

export interface CheckboxProps extends FieldProps {
  readonly color?: ColorSpec;
  readonly checked?: boolean | 'indeterminate';
  readonly defaultChecked?: boolean | 'indeterminate';
  readonly onCheckedChange?: (checked: boolean | 'indeterminate') => void;
  readonly name?: string;
  readonly value?: string;
  readonly id?: string;
  readonly className?: string;
}

const DEFAULT_COLOR: ColorSpec = { color: 'primary', intensity: 500 };
const ERROR_COLOR: ColorSpec = { color: 'red', intensity: 500 };

// `color` paints both the outer border (always) and the checked/indeterminate fill (the
// data-[state=*] variant is the same one Switch's track safelists); the check icon resolves
// through resolveContrastColor for legible contrast against whichever fill is active.
export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  (
    {
      label,
      required,
      disabled,
      error,
      helperText,
      color,
      checked,
      defaultChecked,
      onCheckedChange,
      name,
      value,
      id,
      className,
    },
    ref,
  ) => {
    const autoId = useId();
    const checkboxId = id ?? autoId;
    const helperTextId = helperText !== undefined ? `${checkboxId}-helper` : undefined;

    const activeColor = error ? ERROR_COLOR : (color ?? DEFAULT_COLOR);
    const borderColorClass = resolveColorClass('border', activeColor);
    const fillColorClass = resolveColorClass('bg', activeColor);
    const iconColorClass = resolveColorClass('text', resolveContrastColor(activeColor));

    const rootClasses = mergeClassNames(
      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
      borderColorClass,
      `data-[state=checked]:${fillColorClass}`,
      `data-[state=indeterminate]:${fillColorClass}`,
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary-500',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      className,
    );

    return (
      <FieldShell
        label={label}
        required={required}
        error={error}
        helperText={helperText}
        helperTextId={helperTextId}
        htmlFor={checkboxId}
      >
        <CheckboxPrimitive.Root
          ref={ref}
          id={checkboxId}
          checked={checked}
          defaultChecked={defaultChecked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          required={required}
          name={name}
          value={value}
          aria-invalid={error || undefined}
          aria-describedby={helperTextId}
          className={rootClasses}
        >
          <CheckboxPrimitive.Indicator
            className={mergeClassNames('flex items-center justify-center', iconColorClass)}
          >
            <Icon as="span" name="Check" size={12} weight="bold" />
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
      </FieldShell>
    );
  },
);

Checkbox.displayName = 'Checkbox';
