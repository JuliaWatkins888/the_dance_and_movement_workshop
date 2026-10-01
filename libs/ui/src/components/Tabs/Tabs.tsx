import type { ReactNode } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { mergeClassNames } from '../../theme/mergeClassNames';

export interface TabsProps {
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly children: ReactNode;
  readonly className?: string;
}

// Composition mirrors Select's own split (see components/Select/Select.tsx): `Tabs` owns the
// Root, callers supply `TabsList`/`TabsTrigger`/`TabsContent` children for the actual panes.
export const Tabs = ({ value, defaultValue, onValueChange, children, className }: TabsProps) => (
  <TabsPrimitive.Root
    value={value}
    defaultValue={defaultValue}
    onValueChange={onValueChange}
    className={mergeClassNames('w-full', className)}
  >
    {children}
  </TabsPrimitive.Root>
);

export interface TabsListProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export const TabsList = ({ children, className }: TabsListProps) => (
  // Scrolls sideways rather than wrapping/overflowing when the triggers outgrow a narrow screen.
  // The baseline is an inset shadow, not border-b: a scroll container clips at its padding box,
  // which would cut off the old -mb-px trick that let the active trigger's underline cover it.
  <TabsPrimitive.List
    className={mergeClassNames(
      'flex items-center gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-surface-300)] [scrollbar-width:none]',
      className,
    )}
  >
    {children}
  </TabsPrimitive.List>
);

export interface TabsTriggerProps {
  readonly value: string;
  readonly disabled?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}

export const TabsTrigger = ({ value, disabled, children, className }: TabsTriggerProps) => (
  <TabsPrimitive.Trigger
    value={value}
    disabled={disabled}
    className={mergeClassNames(
      'shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-surface-600 transition-colors',
      'hover:text-surface-900',
      'data-[state=active]:border-primary-500 data-[state=active]:text-surface-900',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
  >
    {children}
  </TabsPrimitive.Trigger>
);

export interface TabsContentProps {
  readonly value: string;
  readonly children: ReactNode;
  readonly className?: string;
}

export const TabsContent = ({ value, children, className }: TabsContentProps) => (
  <TabsPrimitive.Content value={value} className={mergeClassNames('pt-3 focus-visible:outline-none', className)}>
    {children}
  </TabsPrimitive.Content>
);
