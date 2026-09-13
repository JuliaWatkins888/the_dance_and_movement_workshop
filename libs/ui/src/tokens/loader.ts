export const LOADER_VARIANTS = ['spinner', 'ring', 'dots', 'bars', 'pulse'] as const;
export type LoaderVariant = (typeof LOADER_VARIANTS)[number];
