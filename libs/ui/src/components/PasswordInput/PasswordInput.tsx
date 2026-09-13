import { forwardRef, useState } from 'react';
import { Input, type InputProps } from '../Input/Input';
import { Icon } from '../Icon/Icon';

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'exitAdornment'> {}

// A password Input pre-wired with a visibility-toggle exitAdornment (Eye/EyeSlash) - kept as its
// own component rather than duplicated per-page so every password field in the app (login,
// signup, change-password, admin user forms, ...) gets the same toggle behavior for free.
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>((props, ref) => {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      ref={ref}
      type={visible ? 'text' : 'password'}
      exitAdornment={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="flex items-center text-surface-400 hover:text-surface-700"
        >
          <Icon name={visible ? 'EyeSlash' : 'Eye'} size={18} />
        </button>
      }
      {...props}
    />
  );
});

PasswordInput.displayName = 'PasswordInput';
