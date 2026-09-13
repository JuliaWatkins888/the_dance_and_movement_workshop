import type { AlignContent, AlignItems, FlexDirection, FlexSpec, FlexWrap, JustifyContent } from '../tokens/flex';

const DIRECTION_CLASSES: Record<FlexDirection, string> = {
  row: 'flex-row',
  'row-reverse': 'flex-row-reverse',
  col: 'flex-col',
  'col-reverse': 'flex-col-reverse',
};

const WRAP_CLASSES: Record<FlexWrap, string> = {
  wrap: 'flex-wrap',
  'wrap-reverse': 'flex-wrap-reverse',
  nowrap: 'flex-nowrap',
};

const JUSTIFY_CLASSES: Record<JustifyContent, string> = {
  start: 'justify-start',
  end: 'justify-end',
  center: 'justify-center',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

const ALIGN_ITEMS_CLASSES: Record<AlignItems, string> = {
  start: 'items-start',
  end: 'items-end',
  center: 'items-center',
  baseline: 'items-baseline',
  stretch: 'items-stretch',
};

const ALIGN_CONTENT_CLASSES: Record<AlignContent, string> = {
  start: 'content-start',
  end: 'content-end',
  center: 'content-center',
  between: 'content-between',
  around: 'content-around',
  evenly: 'content-evenly',
  stretch: 'content-stretch',
};

// `flex`/`inline-flex` is only applied when a spec is present, so Box/AnimateBox stay
// non-flex containers by default and only opt into flex layout when a caller needs to
// control child alignment.
export const resolveFlexClasses = (spec: FlexSpec | undefined): string | undefined => {
  if (!spec) return undefined;

  return [
    spec.inline ? 'inline-flex' : 'flex',
    spec.direction && DIRECTION_CLASSES[spec.direction],
    spec.wrap && WRAP_CLASSES[spec.wrap],
    spec.justify && JUSTIFY_CLASSES[spec.justify],
    spec.align && ALIGN_ITEMS_CLASSES[spec.align],
    spec.alignContent && ALIGN_CONTENT_CLASSES[spec.alignContent],
    spec.gap !== undefined && `gap-[${spec.gap}px]`,
    spec.rowGap !== undefined && `gap-y-[${spec.rowGap}px]`,
    spec.columnGap !== undefined && `gap-x-[${spec.columnGap}px]`,
  ]
    .filter(Boolean)
    .join(' ');
};
