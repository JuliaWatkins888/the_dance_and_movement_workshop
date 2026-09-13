import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { match } from 'path-to-regexp';
import {
  asyncHandler,
  createSuccessResponse,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
} from '@inithium/api-utils';
import { requireAuth, optionalAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import {
  createPage,
  findPagesByNavLocation,
  findPublishedPages,
  listPages,
  updatePage,
  NAV_LOCATIONS,
} from '@inithium/db';
import type { NavLocation, PageSearchField } from '@inithium/db';
import { createPageSchema, updatePageSchema } from '../schemas/page.schema';

const router: RouterType = Router();

const isNavLocation = (value: string): value is NavLocation =>
  (NAV_LOCATIONS as readonly string[]).includes(value);

const SEARCH_FIELDS = ['title', 'slug', 'routePattern'] as const;
const isSearchField = (value: unknown): value is PageSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

router.get(
  '/api/pages',
  requireAuth,
  requirePermission('pages:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query['page']) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query['pageSize']) || 20));
    const rawSearch = typeof req.query['search'] === 'string' ? req.query['search'] : undefined;
    const search = rawSearch ? rawSearch.trim() : undefined;
    const rawSearchField = req.query['searchField'];
    const searchField = isSearchField(rawSearchField) ? rawSearchField : 'title';

    const result = await listPages({
      page,
      pageSize,
      search: search || undefined,
      searchField: search ? searchField : undefined,
    });

    res.status(200).json(
      createSuccessResponse(result.items, {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
      }),
    );
  }),
);

router.get(
  '/api/pages/resolve',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const rawRoute = typeof req.query['route'] === 'string' ? req.query['route'] : '';
    if (!rawRoute) {
      throw ValidationError('Query parameter "route" is required');
    }

    const pathname = rawRoute.split('?')[0];
    const pages = await findPublishedPages();

    // Prefer an exact static match (e.g. "/blog/new") over a dynamic pattern
    // (e.g. "/blog/:id") so a literal route always wins over an ambiguous one.
    const exactMatch = pages.find((page) => page.routePattern === pathname);
    const page =
      exactMatch ??
      pages.find((candidate) => {
        try {
          return match(candidate.routePattern)(pathname) !== false;
        } catch {
          return false; // Malformed routePattern stored in the DB — skip it, don't 500.
        }
      });

    if (!page) {
      throw NotFoundError('No page matches the requested route');
    }

    if (page.access.isAnonymousOnly && req.user) {
      throw ForbiddenError('This page is only accessible to anonymous visitors');
    }
    if (!page.access.isPublic) {
      if (!req.user) {
        throw UnauthorizedError('Authentication required to access this page');
      }
      if (page.access.requiredRoles.length > 0 && !page.access.requiredRoles.includes(req.user.role)) {
        throw ForbiddenError('You do not have the required role to access this page');
      }
    }

    res.status(200).json(createSuccessResponse(page));
  })
);

router.get(
  '/api/pages/navigation/:location',
  asyncHandler(async (req: Request, res: Response) => {
    // Express 5 types route params as `string | string[]` to allow for repeated
    // segments (e.g. ":name+"); ":location" is a single simple segment, so it
    // will only ever be a plain string at runtime — normalize the type here.
    const rawLocation = req.params.location;
    const location = Array.isArray(rawLocation) ? rawLocation[0] : rawLocation;
    if (!isNavLocation(location)) {
      throw ValidationError(`Invalid nav location "${location}"`, { allowed: NAV_LOCATIONS });
    }
    const pages = await findPagesByNavLocation(location);
    res.status(200).json(createSuccessResponse(pages));
  })
);

router.post(
  '/api/pages',
  requireAuth,
  requirePermission('pages:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createPageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }
    // The Zod schema leaves fields that have a Mongoose-side default as optional
    // (see schemas/page.schema.ts), so CreatePageInput's required fields are
    // filled in here explicitly, mirroring those same Mongoose defaults.
    const page = await createPage({
      ...parsed.data,
      isPluginPage: parsed.data.isPluginPage ?? false,
      backgroundColor: parsed.data.backgroundColor ?? { color: 'surface', intensity: 100 },
      foregroundColor: parsed.data.foregroundColor ?? { color: 'primary-foreground', intensity: 500 },
      isPublished: parsed.data.isPublished ?? false,
    });
    res.status(201).json(createSuccessResponse(page));
  })
);

router.patch(
  '/api/pages/:id',
  requireAuth,
  requirePermission('pages:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updatePageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const page = await updatePage(id, parsed.data);
    if (!page) {
      throw NotFoundError('Page not found');
    }
    res.status(200).json(createSuccessResponse(page));
  })
);

export default router;
