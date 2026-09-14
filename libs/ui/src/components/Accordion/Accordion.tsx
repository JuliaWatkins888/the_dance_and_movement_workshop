import type { ReactNode } from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { Icon } from '../Icon/Icon';

interface AccordionSharedProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export type AccordionProps =
  | (AccordionSharedProps & {
      readonly type: 'single';
      // Whether the single open item can be closed by clicking it again - Radix's own default is
      // false (always one item open); true is almost always what a caller actually wants, so
      // that's the default here instead.
      readonly collapsible?: boolean;
      readonly value?: string;
      readonly defaultValue?: string;
      readonly onValueChange?: (value: string) => void;
    })
  | (AccordionSharedProps & {
      readonly type: 'multiple';
      readonly value?: string[];
      readonly defaultValue?: string[];
      readonly onValueChange?: (value: string[]) => void;
    });

// Composition mirrors Tabs's own split (see components/Tabs/Tabs.tsx): `Accordion` owns the
// Root, callers supply `AccordionItem`/`AccordionTrigger`/`AccordionContent` children for the
// actual panes. Supports nesting natively (an AccordionItem's content can contain another
// Accordion) - the Policies page's category-then-item structure is the first consumer of that.
export const Accordion = (props: AccordionProps) => {
  const { children, className } = props;
  const rootClassName = mergeClassNames('w-full', className);

  if (props.type === 'single') {
    return (
      <AccordionPrimitive.Root
        type="single"
        collapsible={props.collapsible ?? true}
        value={props.value}
        defaultValue={props.defaultValue}
        onValueChange={props.onValueChange}
        className={rootClassName}
      >
        {children}
      </AccordionPrimitive.Root>
    );
  }

  return (
    <AccordionPrimitive.Root
      type="multiple"
      value={props.value}
      defaultValue={props.defaultValue}
      onValueChange={props.onValueChange}
      className={rootClassName}
    >
      {children}
    </AccordionPrimitive.Root>
  );
};

export interface AccordionItemProps {
  readonly value: string;
  readonly children: ReactNode;
  readonly className?: string;
}

// Deliberately unstyled by default (unlike Tabs's own list/trigger, which have one fixed visual
// shape) - a flat FAQ-style list of items and a bordered card sitting in a grid (the Policies
// page's two accordion levels) want genuinely different border/spacing treatments, and baking in
// one of them here would only fight the caller's own className on the other. Same "generic shell,
// caller composes" precedent as Card's own comment.
export const AccordionItem = ({ value, children, className }: AccordionItemProps) => (
  <AccordionPrimitive.Item value={value} className={className}>
    {children}
  </AccordionPrimitive.Item>
);

export interface AccordionTriggerProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export const AccordionTrigger = ({ children, className }: AccordionTriggerProps) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      className={mergeClassNames(
        'flex flex-1 items-center justify-between gap-3 py-3 text-left text-sm font-medium text-surface-900 transition-colors',
        'hover:text-primary-600',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
        '[&[data-state=open]>span:last-child]:rotate-180',
        className,
      )}
    >
      {children}
      <span className="shrink-0 text-surface-500 transition-transform duration-200">
        <Icon as="span" name="CaretDown" size={16} />
      </span>
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
);

export interface AccordionContentProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export const AccordionContent = ({ children, className }: AccordionContentProps) => (
  <AccordionPrimitive.Content className="overflow-hidden pb-3 text-sm text-surface-700">
    <div className={className}>{children}</div>
  </AccordionPrimitive.Content>
);
