export interface BannerTrianglifyConfig {
  // Grid cell size in px driving triangle density - intended range 10-100 (smaller cells
  // produce a busier, more granular mesh).
  readonly cellSize: number;
  // How far a grid point may jitter off its perfect grid position, as a fraction of cellSize -
  // intended range 0.10-1.00 (0 would render a flat, non-organic grid).
  readonly variance: number;
  // Left-to-right gradient stops, sampled by each triangle's centroid position and blended with
  // yColors - see utils/generateTrianglifyMesh.ts.
  readonly xColors: readonly [string, ...string[]];
  // Top-to-bottom gradient stops, sampled by each triangle's centroid position and blended with
  // xColors - see utils/generateTrianglifyMesh.ts.
  readonly yColors: readonly [string, ...string[]];
}

export const DEFAULT_BANNER_HEIGHT = 250;

// The mesh's own generation width whenever Banner's `width` prop isn't an explicit pixel
// number (its default is the fluid "fill the parent" CSS value `100%`, which carries no pixel
// size to generate exact geometry against). The SVG's viewBox stretches this reference mesh to
// fill whatever the real rendered width ends up being - see Banner.tsx's own comment on that
// trade-off.
export const DEFAULT_MESH_WIDTH = 1200;
