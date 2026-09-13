import { dialog } from './dialog';

// A hook wrapper for callers who prefer hook-style access inside components. `dialog` is a
// stable module-level singleton either way (see dialog.tsx) - this never needs to sit inside
// a Provider or triggers no re-renders of its own; it just returns the same object every time.
export const useDialog = () => dialog;
