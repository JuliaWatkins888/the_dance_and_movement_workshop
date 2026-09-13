import type { ReactNode } from 'react';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveFlexClasses } from '../../utils/resolveFlexClasses';
import type { AdornmentProps } from '../../tokens/adornment';

export interface AdornedContentProps extends AdornmentProps {
  readonly children?: ReactNode;
  readonly gap?: number;
  readonly className?: string;
}

const DEFAULT_GAP = 8;

export const AdornedContent = ({ entryAdornment, exitAdornment, children, gap = DEFAULT_GAP, className }: AdornedContentProps) => {
  if (!entryAdornment && !exitAdornment) {
    return <>{children}</>;
  }

  const classes = mergeClassNames(
    resolveFlexClasses({ direction: 'row', align: 'center', justify: 'center', gap }),
    className,
  );

  return (
    <span className={classes}>
      {entryAdornment}
      {children}
      {exitAdornment}
    </span>
  );
};
