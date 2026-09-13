import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveFieldColorClasses } from '../../utils/resolveFieldColorClasses';
import { FieldShell } from '../FieldShell/FieldShell';
import type { ColorSpec } from '../../contracts/color.contract';
import type { FieldProps } from '../../tokens/field';

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'color' | 'disabled' | 'required'>,
    FieldProps {
  readonly color?: ColorSpec;
}

// Mirrors Input's border/focus-ring treatment exactly via resolveFieldColorClasses, with
// vertical resizing enabled by default (disabled alongside the rest of the control when
// `disabled` is set, since a resize handle on a non-interactive control is misleading).
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, required, disabled, error, helperText, color, className, id, ...rest }, ref) => {
    const autoId = useId();
    const textareaId = id ?? autoId;
    const helperTextId = helperText !== undefined ? `${textareaId}-helper` : undefined;

    const { border, focusRing } = resolveFieldColorClasses(color, error);

    const classes = mergeClassNames(
      'w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm text-surface-900 transition-colors placeholder:text-surface-400',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
      'disabled:resize-none disabled:opacity-50 disabled:cursor-not-allowed',
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
        htmlFor={textareaId}
      >
        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          required={required}
          aria-invalid={error || undefined}
          aria-describedby={helperTextId}
          className={classes}
          {...rest}
        />
      </FieldShell>
    );
  },
);

Textarea.displayName = 'Textarea';
