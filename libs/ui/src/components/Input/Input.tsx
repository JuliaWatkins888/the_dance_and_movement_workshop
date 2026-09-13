import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveFieldColorClasses } from '../../utils/resolveFieldColorClasses';
import { FieldShell } from '../FieldShell/FieldShell';
import type { ColorSpec } from '../../contracts/color.contract';
import type { FieldProps } from '../../tokens/field';
import type { AdornmentProps } from '../../tokens/adornment';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'color' | 'disabled' | 'required'>,
    FieldProps,
    AdornmentProps {
  readonly color?: ColorSpec;
}

// entryAdornment/exitAdornment render as absolutely-positioned overlays inside the input's own
// box (e.g. a password-visibility toggle) rather than through AdornedContent's flex-row layout -
// unlike Button, this control's border/background lives on the <input> itself, and an adornment
// needs to sit inside that box, not beside it. The input's own left/right padding shifts to make
// room only when a given side is actually in use, so the no-adornment case (the vast majority of
// callers) renders byte-for-byte the same classes as before.
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, required, disabled, error, helperText, color, className, id, entryAdornment, exitAdornment, ...rest },
    ref,
  ) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const helperTextId = helperText !== undefined ? `${inputId}-helper` : undefined;

    const { border, focusRing } = resolveFieldColorClasses(color, error);

    const classes = mergeClassNames(
      'w-full rounded-md border bg-transparent py-2 text-sm text-surface-900 transition-colors placeholder:text-surface-400',
      entryAdornment ? 'pl-9' : 'pl-3',
      exitAdornment ? 'pr-9' : 'pr-3',
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
        htmlFor={inputId}
      >
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            aria-invalid={error || undefined}
            aria-describedby={helperTextId}
            className={classes}
            {...rest}
          />
          {entryAdornment && (
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">{entryAdornment}</span>
          )}
          {exitAdornment && (
            <span className="absolute inset-y-0 right-0 flex items-center pr-3">{exitAdornment}</span>
          )}
        </div>
      </FieldShell>
    );
  },
);

Input.displayName = 'Input';
