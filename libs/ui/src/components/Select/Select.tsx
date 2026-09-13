import { forwardRef, useId, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveFieldColorClasses } from '../../utils/resolveFieldColorClasses';
import { FieldShell } from '../FieldShell/FieldShell';
import { Icon } from '../Icon/Icon';
import type { ColorSpec } from '../../contracts/color.contract';
import type { FieldProps } from '../../tokens/field';

export interface SelectProps extends FieldProps {
  readonly color?: ColorSpec;
  readonly placeholder?: string;
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly name?: string;
  readonly id?: string;
  readonly children: ReactNode;
  readonly className?: string;
}

// `color` behaves identically to Input's (border + focus ring, overridden to red-500 by
// `error`, see resolveFieldColorClasses). Composition mirrors Radix's own pattern: `Select`
// owns the Root/Trigger/Content/Viewport chrome, callers supply `SelectItem` children for
// the actual options.
export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      label,
      required,
      disabled,
      error,
      helperText,
      color,
      placeholder,
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
    const triggerId = id ?? autoId;
    const helperTextId = helperText !== undefined ? `${triggerId}-helper` : undefined;

    const { border, focusRing } = resolveFieldColorClasses(color, error);

    const triggerClasses = mergeClassNames(
      'flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm text-surface-900 transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      border,
      focusRing,
      className,
    );

    return (
      <FieldShell
        label={label}
        required={required}
        error={error}
        helperText={helperText}
        helperTextId={helperTextId}
        htmlFor={triggerId}
      >
        <SelectPrimitive.Root
          value={value}
          defaultValue={defaultValue}
          onValueChange={onValueChange}
          name={name}
          disabled={disabled}
          required={required}
        >
          <SelectPrimitive.Trigger
            ref={ref}
            id={triggerId}
            aria-invalid={error || undefined}
            aria-describedby={helperTextId}
            className={triggerClasses}
          >
            <SelectPrimitive.Value
              placeholder={placeholder}
              className="data-[placeholder]:text-surface-400"
            />
            <SelectPrimitive.Icon asChild>
              <Icon as="span" name="CaretDown" size={14} />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              position="popper"
              sideOffset={4}
              // z-[210] - above DialogContainer's overlay (z-[200], see
              // components/DialogContainer/DialogContainer.tsx). Select renders its dropdown in
              // its own Radix Portal, a DOM sibling of any Dialog's portal rather than a
              // descendant of it, so without a higher z-index here the dropdown paints *behind*
              // an open dialog's overlay and is invisible/unusable whenever a Select is used
              // inside dialog.show(...) content.
              className="z-[210] overflow-hidden rounded-md border border-surface-300 bg-surface-100 text-surface-foreground-100 shadow-md"
            >
              <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1">
                <Icon as="span" name="CaretUp" size={14} />
              </SelectPrimitive.ScrollUpButton>
              <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
              <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1">
                <Icon as="span" name="CaretDown" size={14} />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
      </FieldShell>
    );
  },
);

Select.displayName = 'Select';

export type SelectItemProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Item>;

export const SelectItem = forwardRef<ElementRef<typeof SelectPrimitive.Item>, SelectItemProps>(
  ({ children, className, ...rest }, ref) => (
    <SelectPrimitive.Item
      ref={ref}
      className={mergeClassNames(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 pr-7 text-sm outline-none',
        'data-[highlighted]:bg-primary-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...rest}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center">
        <Icon as="span" name="Check" size={14} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  ),
);

SelectItem.displayName = 'SelectItem';
