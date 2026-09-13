import type { CSSProperties } from 'react';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveColorClass } from '../../theme/resolveColorClass';
import { resolveContrastColor } from '../../utils/resolveContrastColor';
import { resolveAvatarInitials } from '../../utils/resolveAvatarInitials';
import { resolveAvatarShapeClasses } from '../../utils/resolveAvatarShapeClasses';
import { resolveDicebearUrl } from '../../utils/resolveDicebearUrl';
import { DEFAULT_AVATAR_STYLE, PRESENCE_STATUS_COLOR } from '../../tokens/avatar';
import type { AvatarSource, AvatarStyleConfig, PresenceStatus } from '../../tokens/avatar';

export interface AvatarProps {
  readonly source: AvatarSource;
  // Takes precedence over `source` entirely when set - mirrors Banner's own imageUrl-over-
  // trianglifyConfig precedence (see components/Banner/Banner.tsx). Kept as a sibling prop
  // rather than a third AvatarSource variant so a caller never has to fabricate a fake
  // initials/dicebear source just to satisfy the union when all it has is an override URL.
  readonly imageUrl?: string;
  readonly imageAlt?: string;
  readonly styleConfig?: AvatarStyleConfig;
  // Pixel size of the square/circle box; the initials font and both dimensions scale with it,
  // so this comfortably ranges from small inline avatars up to a large ~200px profile avatar.
  readonly size?: number;
  // Renders a small corner dot indicating live online/busy/away/offline state - omitted
  // entirely (no dot, no layout change) when not provided, so every existing caller renders
  // identically to before.
  readonly status?: PresenceStatus;
  readonly onClick?: () => void;
  readonly className?: string;
}

const DEFAULT_SIZE = 40;
const INITIALS_FONT_RATIO = 0.4;
// The dot reads best at roughly a quarter of the avatar's own size across the whole size range
// this component supports, from small inline avatars up to a large ~200px profile avatar.
const STATUS_DOT_SIZE_RATIO = 0.28;

// Fully prop-driven and stateless - the caller (a profile page reading a user's stored avatar
// config, a member list, a comment thread) decides everything: whether imageUrl overrides
// entirely, which source variant renders otherwise, the bg/font colors, the shape, the size.
// This component never fetches data and knows nothing about `@inithium/db`'s UserEntity - it
// only renders whatever imageUrl/AvatarSource/AvatarStyleConfig it's handed, matching the same
// decoupling every other libs/ui primitive keeps from persistence/domain concerns.
export const Avatar = ({
  source,
  imageUrl,
  imageAlt,
  styleConfig,
  size = DEFAULT_SIZE,
  status,
  onClick,
  className,
}: AvatarProps) => {
  const bgColor = styleConfig?.bgColor ?? DEFAULT_AVATAR_STYLE.bgColor;
  const shape = styleConfig?.shape ?? DEFAULT_AVATAR_STYLE.shape;
  // No explicit fontColor customization yet - resolveContrastColor keeps initials legible
  // against whatever bgColor was picked, the same fallback Switch/Checkbox/RadioGroup use for
  // their own indicator-on-fill contrast.
  const fontColor = styleConfig?.fontColor ?? resolveContrastColor(bgColor);

  const sharedClasses = mergeClassNames(
    'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden',
    resolveAvatarShapeClasses(shape),
  );

  const dimensionStyle: CSSProperties = { width: `${size}px`, height: `${size}px` };

  const content = imageUrl ? (
    <img src={imageUrl} alt={imageAlt ?? ''} className="h-full w-full object-cover" />
  ) : source.variant === 'dicebear' ? (
    <img src={resolveDicebearUrl(source)} alt={source.alt ?? ''} className="h-full w-full object-cover" />
  ) : (
    <span
      className={mergeClassNames('font-medium leading-none', resolveColorClass('text', fontColor))}
      style={{ fontSize: `${size * INITIALS_FONT_RATIO}px` }}
    >
      {resolveAvatarInitials(source.name)}
    </span>
  );

  const avatarBox = onClick ? (
    <button
      type="button"
      onClick={onClick}
      style={dimensionStyle}
      className={mergeClassNames(
        sharedClasses,
        'border-0 bg-transparent p-0 cursor-pointer transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        resolveColorClass('bg', bgColor),
        className,
      )}
    >
      {content}
    </button>
  ) : (
    <div style={dimensionStyle} className={mergeClassNames(sharedClasses, resolveColorClass('bg', bgColor), className)}>
      {content}
    </div>
  );

  if (!status) return avatarBox;

  // sharedClasses includes `overflow-hidden` (needed so image/dicebear sources never bleed past
  // the circle/square) - a naive corner dot placed inside that box would get clipped. This outer
  // span is the un-clipped sibling boundary the dot positions against instead.
  const dotSize = Math.round(size * STATUS_DOT_SIZE_RATIO);
  return (
    <span className="relative inline-block" style={dimensionStyle}>
      {avatarBox}
      <span
        aria-hidden="true"
        style={{ width: `${dotSize}px`, height: `${dotSize}px` }}
        className={mergeClassNames(
          'absolute right-0 bottom-0 rounded-full border-2 border-white',
          resolveColorClass('bg', PRESENCE_STATUS_COLOR[status]),
        )}
      />
    </span>
  );
};
