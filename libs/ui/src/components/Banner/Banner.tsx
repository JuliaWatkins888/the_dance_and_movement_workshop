import type { CSSProperties } from 'react';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { generateTrianglifyMesh } from '../../utils/generateTrianglifyMesh';
import { DEFAULT_BANNER_HEIGHT, DEFAULT_MESH_WIDTH } from '../../tokens/banner';
import type { BannerTrianglifyConfig } from '../../tokens/banner';

export interface BannerProps {
  readonly imageUrl?: string;
  readonly imageAlt?: string;
  readonly trianglifyConfig: BannerTrianglifyConfig;
  // Same number-or-string/toCssSize contract as Divider's own `width` prop.
  readonly width?: number | string;
  readonly height?: number;
  readonly className?: string;
}

const DEFAULT_WIDTH: number | string = '100%';

const toCssSize = (value: number | string): string => (typeof value === 'number' ? `${value}px` : value);

// Fully prop-driven and stateless, mirroring Avatar's own contract - the caller decides
// everything (image vs. generated mesh, the mesh's colors/density, the box's own dimensions).
// `trianglifyConfig` stays mandatory even when `imageUrl` is set, so a caller can drop the
// image later without also having to invent a fallback config at that point.
//
// This never measures its own rendered size (no ResizeObserver/layout effect) - when `width`
// isn't an explicit pixel number (its default is the fluid "fill the parent" `100%`), the mesh
// is generated at DEFAULT_MESH_WIDTH and the SVG's `viewBox` + `preserveAspectRatio="none"`
// stretches it to whatever the real rendered width ends up being. That's a fine approximation
// when the rendered width stays reasonably close to DEFAULT_MESH_WIDTH, but it visibly stretches
// triangles at either extreme (a ~300px sidebar card, a full-bleed hero on an ultra-wide
// screen). A caller spanning that kind of range should measure its own container and pass the
// resolved pixel width in explicitly - see useElementSize, this package's opt-in composable for
// exactly that, which keeps Banner itself pure/effect-free either way.
export const Banner = ({
  imageUrl,
  imageAlt = '',
  trianglifyConfig,
  width = DEFAULT_WIDTH,
  height = DEFAULT_BANNER_HEIGHT,
  className,
}: BannerProps) => {
  const dimensionStyle: CSSProperties = { width: toCssSize(width), height: `${height}px` };

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={imageAlt}
        style={dimensionStyle}
        className={mergeClassNames('block object-cover', className)}
      />
    );
  }

  const meshWidth = typeof width === 'number' ? width : DEFAULT_MESH_WIDTH;
  const triangles = generateTrianglifyMesh(trianglifyConfig, meshWidth, height);

  return (
    <svg
      style={dimensionStyle}
      className={mergeClassNames('block', className)}
      viewBox={`0 0 ${meshWidth} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {triangles.map((triangle) => (
        <polygon
          key={triangle.points}
          points={triangle.points}
          fill={triangle.fill}
          stroke={triangle.fill}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
};
