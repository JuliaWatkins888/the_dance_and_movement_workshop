import * as PhosphorIcons from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { IconName } from '../tokens/icon';

// `name` is already constrained to a real export by the IconName type (derived from this
// same namespace in tokens/icon.ts), so the lookup itself only needs a pragmatic cast, not
// runtime validation.
//
// This namespace import pulls every @phosphor-icons/react icon (~1500+) into the bundle -
// looking one up by a runtime string defeats bundlers' tree-shaking, unlike a caller writing
// `import { SmileyIcon } from '@phosphor-icons/react'` directly. It's the trade that makes
// the `<Icon name="Smiley" />` string API possible at all; swap to per-icon imports (or a
// caller-supplied component prop) if bundle size matters more than that convenience.
export const resolvePhosphorIcon = (name: IconName): Icon =>
  PhosphorIcons[`${name}Icon` as keyof typeof PhosphorIcons] as Icon;
