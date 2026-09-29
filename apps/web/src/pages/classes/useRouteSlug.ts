import { useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageParams } from '@inithium/api-client';

// The :slug of this page's own route. A page stays mounted through its exit animation while the
// location already points at the next page, so a slug from any other path is ignored and the
// last one of its own is kept - the page keeps showing its cached content as it fades out instead
// of fetching the next page's slug as if it were its own (e.g. a course slug requested as a
// program).
export const useRouteSlug = (pathPrefix: string): string | undefined => {
  const { pathname } = useLocation();
  const { slug } = usePageParams();
  const ownSlug = useRef<string | undefined>(undefined);
  if (pathname.startsWith(pathPrefix) && slug) ownSlug.current = slug;
  return ownSlug.current;
};
