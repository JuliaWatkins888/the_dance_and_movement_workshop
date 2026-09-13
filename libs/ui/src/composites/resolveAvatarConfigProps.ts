import type { AvatarConfig } from '@inithium/db';
import type { AvatarSource, AvatarStyleConfig } from '../tokens/avatar';

export interface AvatarConfigProps {
  readonly source: AvatarSource;
  readonly styleConfig: AvatarStyleConfig;
  readonly imageUrl?: string;
  readonly imageAlt?: string;
}

// @inithium/ui's primitives (Avatar included) deliberately know nothing about @inithium/db —
// see Avatar.tsx's own comment on that decoupling — so this mapping from a persisted
// AvatarConfig into Avatar's own {source, styleConfig, imageUrl} props lives here in
// composites/, the one layer in this package that's allowed to bridge domain/persistence shapes
// into primitive props.
//
// AvatarConfig's color fields store intensity/opacity as a plain `number` (libs/db must stay
// ignorant of @inithium/ui's ColorSpec too); the cast trusts that persisted value - Avatar's own
// resolveColorClass call just stringifies whatever number it gets regardless of the compile-time
// ColorIntensity/ColorOpacity union, so an out-of-range stored value degrades to an ungenerated
// Tailwind class rather than crashing.
export const resolveAvatarConfigProps = (avatar: AvatarConfig, fullName: string): AvatarConfigProps => {
  const source: AvatarSource =
    avatar.variant === 'dicebear' && avatar.dicebear
      ? {
          variant: 'dicebear',
          style: avatar.dicebear.style,
          seed: avatar.dicebear.seed,
          options: avatar.dicebear.options,
          alt: fullName,
        }
      : { variant: 'initials', name: fullName };

  return {
    source,
    styleConfig: avatar.style as unknown as AvatarStyleConfig,
    imageUrl: avatar.imageUrl,
    imageAlt: fullName,
  };
};
