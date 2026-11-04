import { CLASS_SOURCE_TYPE, EVENT_SOURCE_TYPE, WORKSHOP_SOURCE_TYPE, useGetPageByRouteQuery } from '@inithium/api-client';
import { PRODUCT_SOURCE_TYPE } from './productLinks';

// Priority order: classes are the studio's main offering, so they win whenever present and are
// the first fallback when nothing in the list matches.
const CATALOGS = [
  { sourceType: CLASS_SOURCE_TYPE, path: '/classes' },
  { sourceType: WORKSHOP_SOURCE_TYPE, path: '/workshops' },
  { sourceType: EVENT_SOURCE_TYPE, path: '/events' },
  { sourceType: PRODUCT_SOURCE_TYPE, path: '/merch' },
] as const;

type CatalogPath = (typeof CATALOGS)[number]['path'];

const HOME_PATH = '/';

// Catalogs of what's in the lines come first (in priority order), then the remaining catalogs,
// skipping any the site isn't currently serving.
export const continueShoppingPath = (
  lines: readonly { readonly sourceType: string }[],
  isAvailable: (path: CatalogPath) => boolean = () => true,
): string => {
  const sourceTypes = new Set(lines.map((line) => line.sourceType));
  const purchased = CATALOGS.filter((catalog) => sourceTypes.has(catalog.sourceType));
  const others = CATALOGS.filter((catalog) => !sourceTypes.has(catalog.sourceType));
  return [...purchased, ...others].map((catalog) => catalog.path).find(isAvailable) ?? HOME_PATH;
};

// Catalog pages are DB-managed records: resolve fails (404/403) when one is unpublished or
// access-restricted. A route still resolving counts as available so the button never waits on it.
export const useContinueShoppingPath = (lines: readonly { readonly sourceType: string }[]): string => {
  const classes = useGetPageByRouteQuery({ route: '/classes' });
  const workshops = useGetPageByRouteQuery({ route: '/workshops' });
  const events = useGetPageByRouteQuery({ route: '/events' });
  const merch = useGetPageByRouteQuery({ route: '/merch' });
  const unavailable: Record<CatalogPath, boolean> = {
    '/classes': classes.isError,
    '/workshops': workshops.isError,
    '/events': events.isError,
    '/merch': merch.isError,
  };
  return continueShoppingPath(lines, (path) => !unavailable[path]);
};
