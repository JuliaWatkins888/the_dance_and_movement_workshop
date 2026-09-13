import { createSeededRandom } from './createSeededRandom';
import { resolveStringHash } from './resolveStringHash';
import { mixHexColors, resolveGradientColor } from './resolveGradientColor';
import type { BannerTrianglifyConfig } from '../tokens/banner';

export interface TrianglifyTriangle {
  readonly points: string;
  readonly fill: string;
}

interface MeshPoint {
  readonly x: number;
  readonly y: number;
}

// Builds a jittered rectangular grid of points, splits every cell into two triangles along a
// pseudo-randomly chosen diagonal, then fills each triangle by blending a color sampled from
// xColors (by its centroid's horizontal position) with one sampled from yColors (by its
// vertical position). This is a deliberately simplified stand-in for the real trianglify
// package's Delaunay triangulation and Lab-space color blending - see Banner.tsx's own comment
// on why: it keeps this package free of trianglify's (unmaintained) dependency chain, the same
// way Avatar's dicebear variant stays free of the @dicebear/* packages, at the cost of being
// "trianglify-inspired" rather than a pixel-identical port.
export const generateTrianglifyMesh = (
  config: BannerTrianglifyConfig,
  width: number,
  height: number,
): readonly TrianglifyTriangle[] => {
  const cellSize = Math.max(1, config.cellSize);
  const variance = Math.min(1, Math.max(0, config.variance));

  const cols = Math.max(1, Math.round(width / cellSize));
  const rows = Math.max(1, Math.round(height / cellSize));

  // Seeding from the resolved config (never Math.random) is what keeps this a pure function -
  // the same props always jitter to the same points, so Banner never flickers on re-render.
  const seed = resolveStringHash(
    `${cellSize}:${variance}:${width}:${height}:${config.xColors.join(',')}:${config.yColors.join(',')}`,
  );
  const random = createSeededRandom(seed);
  const maxJitter = (variance * cellSize) / 2;

  const points: MeshPoint[][] = [];
  for (let row = 0; row <= rows; row += 1) {
    const line: MeshPoint[] = [];
    for (let col = 0; col <= cols; col += 1) {
      const isLeftOrRightEdge = col === 0 || col === cols;
      const isTopOrBottomEdge = row === 0 || row === rows;

      // Edge points only jitter along their own edge (and corners, being both, never jitter at
      // all) - keeps the mesh's outer boundary a perfect rectangle so the banner never shows a
      // gap at its own edges.
      const jitterX = isLeftOrRightEdge ? 0 : (random() * 2 - 1) * maxJitter;
      const jitterY = isTopOrBottomEdge ? 0 : (random() * 2 - 1) * maxJitter;

      line.push({ x: (col / cols) * width + jitterX, y: (row / rows) * height + jitterY });
    }
    points.push(line);
  }

  const resolveFill = (centroid: MeshPoint): string =>
    mixHexColors(
      resolveGradientColor(config.xColors, centroid.x / width),
      resolveGradientColor(config.yColors, centroid.y / height),
      0.5,
    );

  const toPoints = (a: MeshPoint, b: MeshPoint, c: MeshPoint): string =>
    `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`;

  const centroidOf = (a: MeshPoint, b: MeshPoint, c: MeshPoint): MeshPoint => ({
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3,
  });

  const triangles: TrianglifyTriangle[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const topLeft = points[row]![col]!;
      const topRight = points[row]![col + 1]!;
      const bottomLeft = points[row + 1]![col]!;
      const bottomRight = points[row + 1]![col + 1]!;

      // Alternating the split diagonal per cell (chosen from the same seeded stream) avoids the
      // repetitive herringbone look a fixed diagonal direction would produce across the mesh.
      const corners: readonly [MeshPoint, MeshPoint, MeshPoint][] =
        random() < 0.5
          ? [
              [topLeft, topRight, bottomRight],
              [topLeft, bottomRight, bottomLeft],
            ]
          : [
              [topLeft, topRight, bottomLeft],
              [topRight, bottomRight, bottomLeft],
            ];

      corners.forEach(([a, b, c]) => {
        triangles.push({ points: toPoints(a, b, c), fill: resolveFill(centroidOf(a, b, c)) });
      });
    }
  }

  return triangles;
};
