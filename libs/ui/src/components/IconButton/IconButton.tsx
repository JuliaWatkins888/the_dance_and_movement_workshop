import { forwardRef } from 'react';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import type { ButtonVariantSpec } from '../../tokens/button';
import type { ColorSpec } from '../../contracts/color.contract';
import type { IconName } from '../../tokens/icon';

export interface IconButtonProps {
  readonly icon: IconName;
  readonly label: string;
  readonly onClick?: () => void;
  readonly variant?: ButtonVariantSpec;
  readonly textColor?: ColorSpec;
  readonly iconSize?: number;
  readonly disabled?: boolean;
  readonly className?: string;
}

// A standalone icon-only action button (sidebar toggle, per-row edit/delete) - deliberately not
// asChild-composable, unlike Button itself. A nav link that happens to render icon+label (see
// Navbar's NavLink) composes Button+Icon+Link directly instead, since that's a different shape
// (a link wrapping an icon, not a bare action button) with its own existing precedent.
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      label,
      onClick,
      variant = { kind: 'ghost', color: 'surface' },
      textColor,
      iconSize = 20,
      disabled,
      className,
    },
    ref,
  ) => (
    <Button
      ref={ref}
      type="button"
      variant={variant}
      textColor={textColor}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={className}
    >
      <Icon name={icon} size={iconSize} />
    </Button>
  ),
);

IconButton.displayName = 'IconButton';
