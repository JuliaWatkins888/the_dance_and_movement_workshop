import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import type { ColorSpec, ColorOpacity } from '../../contracts/color.contract';
import type { LoaderVariant } from '../../tokens/loader';
import type { SpacingProps } from '../../tokens/spacing';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveColorClass } from '../../theme/resolveColorClass';
import { resolveMargin, resolvePadding } from '../../utils/resolveSpacing';

export type { LoaderVariant } from '../../tokens/loader';

export interface LoaderProps
  extends Omit<HTMLAttributes<HTMLElement>, 'color'>,
    SpacingProps {
  readonly as?: ElementType;
  readonly variant?: LoaderVariant;
  readonly color?: ColorSpec;
  // Background/"track" color for variants with a static element behind the moving one (spinner's
  // ring, ring's orbit path). Defaults to `color` at low opacity, so a two-tone look works with
  // zero config - pass this only to pick an explicit track color instead (e.g. a light track
  // under a dark arc on a colored surface).
  readonly trackColor?: ColorSpec;
  readonly size?: number | string;
  readonly label?: string;
  readonly className?: string;
}

const DEFAULT_VARIANT: LoaderVariant = 'spinner';
const DEFAULT_COLOR: ColorSpec = { color: 'primary', intensity: 600 };
const DEFAULT_SIZE = '1.5rem';
const DEFAULT_TRACK_OPACITY: ColorOpacity = 20;
const DOT_DELAYS_MS = [0, 160, 320];
const BAR_DELAYS_MS = [0, 120, 240, 360];

const toCssSize = (val: number | string): string =>
  typeof val === 'number' ? `${val}px` : val;

const resolveVariantTemplate = (
  variant: LoaderVariant,
  color: ColorSpec,
  trackColor: ColorSpec,
): ReactNode => {
  // SVG strokes/fills follow `currentColor`, which only tracks a `text-*` class - a `border-*`
  // class (the previous track implementation) has no effect on an SVG shape at all, so the old
  // `bgColor` prop silently did nothing for the spinner variant.
  const strokeColorClass = resolveColorClass('text', color);
  const trackStrokeColorClass = resolveColorClass('text', trackColor);
  const fillColorClass = resolveColorClass('bg', color);
  const trackBorderColorClass = resolveColorClass('border', trackColor);

  const renderers: Record<LoaderVariant, () => ReactNode> = {
    // Two overlaid circles rotating together: the full track circle is rotationally symmetric
    // (its own rotation is invisible), and a short round-capped arc on top reads as the moving
    // indicator - `pathLength` normalizes strokeDasharray to 0-100 regardless of the circle's
    // actual radius, so the arc length stays correct at any `size`.
    spinner: () => (
      <svg className="w-full h-full animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle
          className={trackStrokeColorClass}
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <circle
          className={strokeColorClass}
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="30 70"
        />
      </svg>
    ),
    // A static track ring with a small dot orbiting it - a distinct silhouette from `spinner`
    // (a moving arc) that reads well at larger sizes, where a thin arc alone can look sparse.
    ring: () => (
      <span className="relative block w-full h-full">
        <span className={mergeClassNames('absolute inset-0 rounded-full border-[3px]', trackBorderColorClass)} />
        <span className="absolute inset-0 animate-spin">
          <span
            className={mergeClassNames('absolute top-0 left-1/2 rounded-full', fillColorClass)}
            style={{ width: '28%', height: '28%', transform: 'translate(-50%, -50%)' }}
          />
        </span>
      </span>
    ),
    dots: () => (
      <span className="flex items-center justify-between w-full h-full px-[5%]">
        {DOT_DELAYS_MS.map((delay) => (
          <span
            key={delay}
            className={mergeClassNames('w-1/4 h-1/4 rounded-full animate-loader-dot shrink-0', fillColorClass)}
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    ),
    bars: () => (
      <span className="flex items-end justify-between w-full h-full gap-[10%]">
        {BAR_DELAYS_MS.map((delay) => (
          <span
            key={delay}
            className={mergeClassNames('flex-1 h-full rounded-full origin-bottom animate-loader-bar', fillColorClass)}
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    ),
    // A solid dot breathing in scale+opacity - unlike Tailwind's animate-ping (built for a single
    // one-shot notification ripple), this never fully disappears between cycles, so it reads as
    // a continuous loading rhythm rather than a blink.
    pulse: () => <span className={mergeClassNames('block w-full h-full rounded-full animate-loader-pulse', fillColorClass)} />,
  };

  return (renderers[variant] ?? renderers.spinner)();
};

export const Loader = ({
  as: Component = 'span',
  variant = DEFAULT_VARIANT,
  color = DEFAULT_COLOR,
  trackColor,
  size = DEFAULT_SIZE,
  label = 'Loading...',
  margin,
  padding,
  className,
  style,
  ...rest
}: LoaderProps) => {
  const cssSize = toCssSize(size);
  const resolvedTrackColor = trackColor ?? { ...color, opacity: DEFAULT_TRACK_OPACITY };

  const containerClasses = mergeClassNames(
    'inline-flex items-center justify-center shrink-0 overflow-visible',
    resolveMargin(margin),
    resolvePadding(padding),
    className,
  );

  const containerStyle = {
    width: cssSize,
    height: cssSize,
    ...style,
  };

  return (
    <Component
      role="status"
      aria-label={label}
      className={containerClasses}
      style={containerStyle}
      {...rest}
    >
      {resolveVariantTemplate(variant, color, resolvedTrackColor)}
      <span className="sr-only">{label}</span>
    </Component>
  );
};
