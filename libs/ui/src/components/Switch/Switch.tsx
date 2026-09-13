import { forwardRef, useId } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { resolveColorClass } from '../../theme/resolveColorClass';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveContrastColor } from '../../utils/resolveContrastColor';
import { FieldShell } from '../FieldShell/FieldShell';
import type { ColorSpec } from '../../contracts/color.contract';
import type { FieldProps } from '../../tokens/field';

export interface SwitchProps extends FieldProps {
  readonly color?: ColorSpec;
  readonly checked?: boolean;
  readonly defaultChecked?: boolean;
  readonly onCheckedChange?: (checked: boolean) => void;
  readonly name?: string;
  readonly value?: string;
  readonly id?: string;
  readonly className?: string;
}

const DEFAULT_TRACK_COLOR: ColorSpec = { color: 'primary', intensity: 500 };
const ERROR_COLOR: ColorSpec = { color: 'red', intensity: 500 };

// `color` only paints the track while checked (see the data-[state=checked] variant below);
// the unchecked track stays a neutral surface-200 regardless of `color`. The thumb always
// resolves through resolveContrastColor so it reads clearly against whichever track color
// ends up active.
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
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
    const switchId = id ?? autoId;
    const helperTextId = helperText !== undefined ? `${switchId}-helper` : undefined;

    const activeColor = error ? ERROR_COLOR : (color ?? DEFAULT_TRACK_COLOR);
    const activeColorClass = resolveColorClass('bg', activeColor);
    const thumbColorClass = resolveColorClass('bg', resolveContrastColor(activeColor));

    const rootClasses = mergeClassNames(
      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-surface-200 transition-colors',
      `data-[state=checked]:${activeColorClass}`,
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary-500',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      className,
    );

    const thumbClasses = mergeClassNames(
      'pointer-events-none block h-5 w-5 translate-x-0.5 rounded-full shadow-sm transition-transform data-[state=checked]:translate-x-5',
      thumbColorClass,
    );

    return (
      <FieldShell
        label={label}
        required={required}
        error={error}
        helperText={helperText}
        helperTextId={helperTextId}
        htmlFor={switchId}
      >
        <SwitchPrimitive.Root
          ref={ref}
          id={switchId}
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
          <SwitchPrimitive.Thumb className={thumbClasses} />
        </SwitchPrimitive.Root>
      </FieldShell>
    );
  },
);

Switch.displayName = 'Switch';
