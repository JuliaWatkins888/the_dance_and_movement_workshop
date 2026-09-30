import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import {
  createGalleryImage,
  deleteGalleryImage,
  getGalleryImageById,
  listGalleryImages,
  listPublishedGalleryImages,
  updateGalleryImage,
} from '@inithium/db';
import type { GalleryImageSearchField } from '@inithium/db';
import { createGalleryImageSchema, updateGalleryImageSchema } from '../schemas/gallery.schema';
import { releaseCloudAsset, releaseReplacedCloudAsset, resolveCloudAssetUrl } from '../services/cloud-image.service';

const router: RouterType = Router();

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const SEARCH_FIELDS = ['title'] as const;
const isSearchField = (value: unknown): value is GalleryImageSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

router.get(
  '/api/gallery',
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query['page']) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query['pageSize']) || 20));

    const result = await listPublishedGalleryImages({ page, pageSize });

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

// Registered before "/api/gallery/:id" - literal segments ahead of a param route, the same
// ordering blog.route.ts uses for its own "/categories"/"/authors" routes and for the same
// reason (Express matches in registration order; a literal isn't preferred over a param route
// the way it is in the frontend's own routePattern matching).
router.get(
  '/api/gallery/admin',
  requireAuth,
  requirePermission('gallery:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query['page']) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query['pageSize']) || 20));
    const rawSearch = typeof req.query['search'] === 'string' ? req.query['search'].trim() : undefined;
    const rawSearchField = req.query['searchField'];
    const searchField = isSearchField(rawSearchField) ? rawSearchField : 'title';

    const result = await listGalleryImages({
      page,
      pageSize,
      search: rawSearch || undefined,
      searchField: rawSearch ? searchField : undefined,
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

router.post(
  '/api/gallery',
  requireAuth,
  requirePermission('gallery:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createGalleryImageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const { assetId, ...rest } = parsed.data;
    const image = await createGalleryImage({
      ...rest,
      ...(rest.sourceType === 'cloud' && assetId ? { assetId, url: await resolveCloudAssetUrl(assetId) } : {}),
      isPublished: parsed.data.isPublished ?? false,
      uploadedBy: req.user!.sub,
    });
    res.status(201).json(createSuccessResponse(image));
  }),
);

router.put(
  '/api/gallery/:id',
  requireAuth,
  requirePermission('gallery:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const parsed = updateGalleryImageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const previous = await getGalleryImageById(id);
    if (!previous) {
      throw NotFoundError('Gallery image not found');
    }

    const { assetId, ...rest } = parsed.data;
    const isSourceChange = rest.sourceType !== undefined;
    const nextAssetId = isSourceChange ? (rest.sourceType === 'cloud' ? assetId : undefined) : previous.assetId;
    const image = await updateGalleryImage(id, {
      ...rest,
      ...(isSourceChange ? { assetId: nextAssetId ?? null } : {}),
      ...(isSourceChange && nextAssetId ? { url: await resolveCloudAssetUrl(nextAssetId) } : {}),
    });
    if (!image) {
      throw NotFoundError('Gallery image not found');
    }
    await releaseReplacedCloudAsset(previous.assetId, nextAssetId);
    res.status(200).json(createSuccessResponse(image));
  }),
);

router.delete(
  '/api/gallery/:id',
  requireAuth,
  requirePermission('gallery:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const image = await getGalleryImageById(id);
    if (!image) {
      throw NotFoundError('Gallery image not found');
    }

    await releaseCloudAsset(image.assetId);
    await deleteGalleryImage(id);
    res.status(204).send();
  }),
);

export default router;
