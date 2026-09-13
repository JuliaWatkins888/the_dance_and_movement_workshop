export const DRAWER_SIDES = ['left', 'right'] as const;
export type DrawerSide = (typeof DRAWER_SIDES)[number];
