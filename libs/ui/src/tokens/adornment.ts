import type { ReactNode } from 'react';

// Shared by any primitive with a leading/trailing slot around its main content - Button
// today, Input/Select later - so all of them take the same two props for the same concept
// instead of each inventing its own icon-slot naming.
export interface AdornmentProps {
  readonly entryAdornment?: ReactNode;
  readonly exitAdornment?: ReactNode;
}
