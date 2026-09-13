import { useLocation } from 'react-router-dom';
import { match } from 'path-to-regexp';
import { useGetPageByRouteQuery } from './endpoints/page.endpoints';

// This app's routing is fully data-driven (see PageShell/App's own comments) - there is no
// react-router <Route> anywhere establishing a param-bearing path, so react-router-dom's own
// useParams() always returns {} here, regardless of the real URL. A page component that needs a
// dynamic segment from its own routePattern (e.g. a blog post page's "/blog/:id") calls this
// hook instead of useParams().
//
// It re-reads the exact same useGetPageByRouteQuery({route}) cache entry App.tsx already
// populated for the current location (same arguments -> same RTK Query cache key, so this never
// triggers a second network request), then re-derives the params by matching the resolved
// page's own routePattern against the current pathname with the same path-to-regexp matcher
// libs/api-core's /api/pages/resolve route uses server-side.
export const usePageParams = (): Record<string, string> => {
  const location = useLocation();
  const route = `${location.pathname}${location.search}`;
  const { data: page } = useGetPageByRouteQuery({ route });

  if (!page) return {};

  try {
    const result = match(page.routePattern)(location.pathname);
    return result ? (result.params as Record<string, string>) : {};
  } catch {
    return {}; // Malformed routePattern stored in the DB - skip it, don't throw.
  }
};
