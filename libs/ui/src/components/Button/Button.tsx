import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { resolveColorClass } from '../../theme/resolveColorClass';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveAnimationClasses } from '../../utils/resolveAnimationClasses';
import { resolveMargin, resolvePadding } from '../../utils/resolveSpacing';
import { resolveButtonVariant } from '../../utils/resolveButtonVariant';
import { AdornedContent } from '../AdornedContent/AdornedContent';
import type { ColorSpec } from '../../contracts/color.contract';
import type { AnimationSpec, AnimationTrigger } from '../../tokens/animation';
import type { SpacingProps } from '../../tokens/spacing';
import type { AdornmentProps } from '../../tokens/adornment';
import type { ButtonVariantSpec } from '../../tokens/button';

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    SpacingProps,
    AdornmentProps {
  readonly asChild?: boolean;
  readonly variant?: ButtonVariantSpec;
  readonly bgColor?: ColorSpec;
  readonly textColor?: ColorSpec;
  readonly borderColor?: ColorSpec;
  readonly animation?: AnimationSpec;
  readonly trigger?: AnimationTrigger;
}

// `variant` resolves a coherent baseline - colors, structural/hover classes, padding - for
// one of four visual kinds (see resolveButtonVariant). bgColor/textColor/borderColor/padding/
// margin/className stay available underneath it as a full escape hatch and always win over
// whatever `variant` resolved, so a caller overriding just one visual layer doesn't have to
// fight or duplicate the rest of the variant's choices.
//
// Native attributes (onClick, type, disabled, form, aria-*, ...) pass through via `rest` so
// Button stays a drop-in <button> replacement - unlike Text/Box/AnimateBox, which only
// destructure their own known props, a button is an interactive element and needs the full
// native surface to be usable.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild = false,
      variant,
      bgColor,
      textColor,
      borderColor,
      animation,
      trigger = 'entrance',
      margin,
      padding,
      className,
      entryAdornment,
      exitAdornment,
      children,
      ...rest
    },
    ref,
  ) => {
    const Component = asChild ? Slot : 'button';
    const defaults = resolveButtonVariant(variant);

    const resolvedBgColor = bgColor ?? defaults.bgColor;
    const resolvedTextColor = textColor ?? defaults.textColor;
    const resolvedBorderColor = borderColor ?? defaults.borderColor;
    const resolvedPadding = padding ?? defaults.padding;

    const classes = mergeClassNames(
      // 1px fallback so an explicit borderColor still renders when the resolved variant (or
      // no variant at all) doesn't declare its own border-width utility; variant classes
      // below win this conflict whenever they do declare one (border-2 / border-b-2).
      resolvedBorderColor && 'border',
      defaults.className,
      resolveColorClass('bg', resolvedBgColor),
      resolveColorClass('text', resolvedTextColor),
      resolveColorClass('border', resolvedBorderColor),
      resolveAnimationClasses(animation, trigger),
      resolveMargin(margin),
      resolvePadding(resolvedPadding),
      className,
    );

    // asChild hands rendering entirely to the single child Slot merges its props onto (e.g.
    // an <a>) - wrapping that child in AdornedContent would make Slot merge onto the wrapper
    // span instead of the caller's actual element, defeating the point of asChild. Adornments
    // only apply on the native <button> path; an asChild caller composes them inside their
    // own child if it wants them.
    const content = asChild ? (
      children
    ) : (
      <AdornedContent entryAdornment={entryAdornment} exitAdornment={exitAdornment}>
        {children}
      </AdornedContent>
    );

    return (
      <Component ref={ref} className={classes} {...rest}>
        {content}
      </Component>
    );
  },
);

Button.displayName = 'Button';
