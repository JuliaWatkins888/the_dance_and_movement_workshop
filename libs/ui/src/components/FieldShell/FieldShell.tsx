import type { ReactNode } from 'react';
import { mergeClassNames } from '../../theme/mergeClassNames';

export interface FieldShellProps {
  readonly label?: string;
  readonly labelId?: string;
  readonly htmlFor?: string;
  readonly required?: boolean;
  readonly error?: boolean;
  readonly helperText?: string;
  readonly helperTextId?: string;
  readonly children: ReactNode;
  readonly className?: string;
}

// Internal layout chrome shared by every input primitive - not part of the public API.
// `htmlFor` wires a single focusable control (Input, Select trigger, Switch/Checkbox
// root, Textarea) directly to the label; controls with no single focusable element
// (RadioGroup) instead pass `labelId` and point their own `aria-labelledby` at it, since
// a <label> without a matching `htmlFor` still renders but confers no native association.
export const FieldShell = ({
  label,
  labelId,
  htmlFor,
  required,
  error,
  helperText,
  helperTextId,
  children,
  className,
}: FieldShellProps) => (
  <div className={mergeClassNames('flex flex-col gap-1.5', className)}>
    {label && (
      <label id={labelId} htmlFor={htmlFor} className="text-sm font-medium text-surface-900">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
    )}
    {children}
    {helperText !== undefined && (
      <span
        id={helperTextId}
        className={mergeClassNames('text-xs', error ? 'text-red-500' : 'text-surface-300')}
      >
        {helperText}
      </span>
    )}
  </div>
);
