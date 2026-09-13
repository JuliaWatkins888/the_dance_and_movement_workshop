import { drawer } from './drawer';

// A hook wrapper for callers who prefer hook-style access inside components. `drawer` is a
// stable module-level singleton either way (see drawer.ts) - this never needs to sit inside a
// Provider or triggers no re-renders of its own; it just returns the same object every time.
export const useDrawer = () => drawer;
