export type SpacingValue = number;

export interface DirectionalSpacing {
  readonly base?: SpacingValue;
  readonly top?: SpacingValue;
  readonly right?: SpacingValue;
  readonly bottom?: SpacingValue;
  readonly left?: SpacingValue;
}

export type SpacingProp = SpacingValue | DirectionalSpacing;

export interface SpacingProps {
  readonly margin?: SpacingProp;
  readonly padding?: SpacingProp;
}
