import { useCallback, useState } from 'react';

export interface ElementSize {
  readonly width: number;
  readonly height: number;
}

export interface UseElementSizeResult {
  // A callback ref, not useRef+useEffect, so the observer re-attaches correctly even if the
  // measured element's identity changes across renders (e.g. conditionally rendered content).
  readonly ref: (node: HTMLElement | null) => void;
  // undefined until the ref attaches and the first measurement resolves - callers needing a
  // pixel width up front (Banner's `width` prop, say) should treat that as "not measured yet"
  // and fall back to their own default for that one paint.
  readonly size: ElementSize | undefined;
}

// Generic live element-size tracking via ResizeObserver - not tied to Banner or any other
// consumer, so anything else needing a real pixel size to render against (a chart, a canvas)
// reuses this unchanged rather than re-deriving its own observer bookkeeping.
//
// This is the one sanctioned exception to this package's otherwise effect-free/pure-render
// components: some outputs (Banner's generated trianglify mesh chief among them) are only
// visually correct - undistorted, uncropped - when built against the element's *actual*
// rendered pixel size, which isn't knowable from props alone when that size is fluid (e.g.
// Banner's default `width="100%"`, meant to span anything from a 300px sidebar card up to a
// full-bleed hero). Rather than push a ResizeObserver into Banner itself and break its "dumb,
// prop-driven" contract for every caller (including the common case of an already-fixed-size
// banner), that concern is opt-in and lives here: wrap the element in question, feed the
// resolved `size.width` back in as an explicit numeric prop.
//
//   const { ref, size } = useElementSize();
//   <div ref={ref} className="w-full">
//     <Banner trianglifyConfig={config} width={size?.width} />
//   </div>
export const useElementSize = (): UseElementSizeResult => {
  const [size, setSize] = useState<ElementSize>();

  const ref = useCallback((node: HTMLElement | null) => {
    if (!node) return;

    // An immediate synchronous read means callers get a real size on first paint instead of
    // waiting a frame for the observer's first callback.
    setSize({ width: node.clientWidth, height: node.clientHeight });

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(node);

    // React 19 callback refs may return a cleanup function, invoked when the node is detached
    // or swapped - the same lifecycle a useEffect cleanup would give a useRef-based version,
    // without needing a separate effect.
    return () => observer.disconnect();
  }, []);

  return { ref, size };
};
