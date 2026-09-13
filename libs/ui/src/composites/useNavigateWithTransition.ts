import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// A thin, named wrapper around react-router's own navigate function. The actual exit-then-enter
// sequencing lives entirely in PageShell, which reacts to *any* change in the resolved page
// regardless of how the URL got there - so this hook doesn't need to orchestrate the transition
// itself, only give app code one consistent, documented entry point for triggering a
// transitioned navigation (a Login button, a post-signup redirect, ...) instead of reaching for
// react-router's useNavigate directly. Keeping that one seam here means a future need - closing
// an open drawer before navigating, for instance - has a single place to land.
export const useNavigateWithTransition = (): ((path: string) => void) => {
  const navigate = useNavigate();
  return useCallback((path: string) => navigate(path), [navigate]);
};
