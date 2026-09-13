import type { SpacingValue } from './spacing';

export const FLEX_DIRECTIONS = ['row', 'row-reverse', 'col', 'col-reverse'] as const;
export type FlexDirection = (typeof FLEX_DIRECTIONS)[number];

export const FLEX_WRAPS = ['wrap', 'wrap-reverse', 'nowrap'] as const;
export type FlexWrap = (typeof FLEX_WRAPS)[number];

export const JUSTIFY_CONTENTS = ['start', 'end', 'center', 'between', 'around', 'evenly'] as const;
export type JustifyContent = (typeof JUSTIFY_CONTENTS)[number];

export const ALIGN_ITEMS = ['start', 'end', 'center', 'baseline', 'stretch'] as const;
export type AlignItems = (typeof ALIGN_ITEMS)[number];

export const ALIGN_CONTENTS = ['start', 'end', 'center', 'between', 'around', 'evenly', 'stretch'] as const;
export type AlignContent = (typeof ALIGN_CONTENTS)[number];

export interface FlexSpec {
  readonly inline?: boolean;
  readonly direction?: FlexDirection;
  readonly wrap?: FlexWrap;
  readonly justify?: JustifyContent;
  readonly align?: AlignItems;
  readonly alignContent?: AlignContent;
  readonly gap?: SpacingValue;
  readonly rowGap?: SpacingValue;
  readonly columnGap?: SpacingValue;
}

export interface FlexProps {
  readonly flex?: FlexSpec;
}
