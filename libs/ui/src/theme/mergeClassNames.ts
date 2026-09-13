import { twMerge, type ClassNameValue } from 'tailwind-merge';

// Plain string concatenation can't guarantee a caller's escape-hatch className wins:
// Tailwind's cascade is decided by generated stylesheet order, not by position in a
// className string, so two classes from the same utility group (e.g. two "text-*"
// colors) don't reliably resolve last-wins under a naive join. twMerge understands
// Tailwind's utility groups and keeps the last conflicting one, giving callers a real
// override.
export const mergeClassNames = (...classes: ClassNameValue[]): string | undefined =>
  twMerge(...classes) || undefined;
