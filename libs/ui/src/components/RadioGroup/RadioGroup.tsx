import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { resolveColorClass } from '../../theme/resolveColorClass';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveContrastColor } from '../../utils/resolveContrastColor';
import { FieldShell } from '../FieldShell/FieldShell';
import type { ColorSpec } from '../../contracts/color.contract';
import type { FieldProps } from '../../tokens/field';

export interface RadioGroupProps extends FieldProps {
  readonly color?: ColorSpec;
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly name?: string;
  readonly id?: string;
  readonly children: ReactNode;
  readonly className?: string;
}

const DEFAULT_COLOR: ColorSpec = { color: 'primary', intensity: 500 };
const ERROR_COLOR: ColorSpec = { color: 'red', intensity: 500 };

interface RadioItemColorClasses {
  readonly border: string;
  readonly fill: string;
  readonly indicator: string;
}

const resolveItemColorClasses = (color: ColorSpec): RadioItemColorClasses => ({
  border: resolveColorClass('border', color) as string,
  fill: resolveColorClass('bg', color) as string,
  indicator: resolveColorClass('bg', resolveContrastColor(color)) as string,
});

const RadioGroupColorContext = createContext<RadioItemColorClasses>(
  resolveItemColorClasses(DEFAULT_COLOR),
);

// `color` behaves identically to Checkbox's (see resolveContrastColor): it paints every
// item's outer border and checked fill. Each RadioGroupItem is a separate element the
// caller renders as a child rather than something RadioGroup can style directly, so the
// resolved classes travel down via context instead of props.
export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
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
      name,
      id,
      children,
      className,
    },
    ref,
  ) => {
    const autoId = useId();
    const groupId = id ?? autoId;
    const labelId = `${groupId}-label`;
    const helperTextId = helperText !== undefined ? `${groupId}-helper` : undefined;

    const activeColor = error ? ERROR_COLOR : (color ?? DEFAULT_COLOR);
    const colorClasses = resolveItemColorClasses(activeColor);

    return (
      <FieldShell
        label={label}
        labelId={label ? labelId : undefined}
        required={required}
        error={error}
        helperText={helperText}
        helperTextId={helperTextId}
      >
        <RadioGroupPrimitive.Root
          ref={ref}
          id={groupId}
          value={value}
          defaultValue={defaultValue}
          onValueChange={onValueChange}
          name={name}
          disabled={disabled}
          required={required}
          aria-labelledby={label ? labelId : undefined}
          aria-invalid={error || undefined}
          aria-describedby={helperTextId}
          className={mergeClassNames('flex flex-col gap-2', className)}
        >
          <RadioGroupColorContext.Provider value={colorClasses}>{children}</RadioGroupColorContext.Provider>
        </RadioGroupPrimitive.Root>
      </FieldShell>
    );
  },
);

RadioGroup.displayName = 'RadioGroup';

export interface RadioGroupItemProps extends ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  readonly label?: string;
}

export const RadioGroupItem = forwardRef<ElementRef<typeof RadioGroupPrimitive.Item>, RadioGroupItemProps>(
  ({ label, className, id, ...rest }, ref) => {
    const autoId = useId();
    const itemId = id ?? autoId;
    const { border, fill, indicator } = useContext(RadioGroupColorContext);

    return (
      <div className="flex items-center gap-2">
        <RadioGroupPrimitive.Item
          ref={ref}
          id={itemId}
          className={mergeClassNames(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
            border,
            `data-[state=checked]:${fill}`,
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className,
          )}
          {...rest}
        >
          <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
            <span className={mergeClassNames('h-1.5 w-1.5 rounded-full', indicator)} />
          </RadioGroupPrimitive.Indicator>
        </RadioGroupPrimitive.Item>
        {label && (
          <label htmlFor={itemId} className="text-sm text-surface-900">
            {label}
          </label>
        )}
      </div>
    );
  },
);

RadioGroupItem.displayName = 'RadioGroupItem';
