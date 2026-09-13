import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import type { NextFunction, Request, Response, Router as RouterType } from 'express';
import multer from 'multer';
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

const router: RouterType = Router();

// Lives in the source tree, never under dist/ (webpack's own output.clean wipes dist/apps/api on
// every build) and never under apps/api/src/assets (that folder is only copied into dist at BUILD
// time, so a runtime write there is invisible until a rebuild, and still gets wiped by the next
// clean regardless). process.cwd() is the monorepo root for both `nx serve api` and a typical
// Render "Start Command" run from the repo root. This directory must be committed to git for an
// upload to survive a redeploy - the whole reason it lives here instead of in dist.
const GALLERY_UPLOAD_DIR = path.resolve(process.cwd(), 'apps/api/uploads/gallery');
fs.mkdirSync(GALLERY_UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
// No image/svg+xml - an uploaded SVG can carry <script> and is a stored-XSS vector once rendered
// as/inlined via <img>. Matches the storage plugin's own allowlist exactly.
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const SEARCH_FIELDS = ['title'] as const;
const isSearchField = (value: unknown): value is GalleryImageSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

// Bytes land on disk directly (not memoryStorage, which is what storage.route.ts uses before
// forwarding to S3) under a random filename - the original filename is never used for anything,
// including the response, which sidesteps path-traversal from a hostile original name entirely.
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, GALLERY_UPLOAD_DIR),
    filename: (_req, file, callback) => {
      const extension = EXTENSION_BY_MIME_TYPE[file.mimetype] ?? 'bin';
      callback(null, `${randomUUID()}.${extension}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!(file.mimetype in EXTENSION_BY_MIME_TYPE)) {
      callback(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    callback(null, true);
  },
});

// multer's own errors (and fileFilter rejections) don't compose with the shared errorHandler on
// their own - it only special-cases `instanceof AppError` - so this adapts them into a clean
// ValidationError before calling next(), the same adapter storage.route.ts uses for the same
// reason.
const handleUpload = (req: Request, res: Response, next: NextFunction): void => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(ValidationError(err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Max size is 5MB.' : err.message));
      return;
    }
    if (err) {
      next(ValidationError(err instanceof Error ? err.message : 'Invalid file upload'));
      return;
    }
    next();
  });
};

// Read live rather than cached at module scope, matching how every other env-driven value in
// this codebase (e.g. WEB_ORIGIN in apps/api/src/main.ts) is read - apps/web runs on a different
// origin, so a returned upload URL must be absolute. Document API_PUBLIC_URL in the consuming
// workspace's own .env (no manifest mechanism injects into .env.example - see STORAGE_* vars'
// own precedent for the same limitation).
const resolvePublicOrigin = (): string =>
  process.env['API_PUBLIC_URL'] || `http://localhost:${process.env['PORT'] || 3000}`;

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
  '/api/gallery/upload',
  requireAuth,
  requirePermission('gallery:manage'),
  handleUpload,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw ValidationError('No file was uploaded');
    }
    res.status(201).json(
      createSuccessResponse({
        url: `${resolvePublicOrigin()}/api/gallery/uploads/${req.file.filename}`,
        storageKey: req.file.filename,
      }),
    );
  }),
);

router.use('/api/gallery/uploads', express.static(GALLERY_UPLOAD_DIR));

router.post(
  '/api/gallery',
  requireAuth,
  requirePermission('gallery:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createGalleryImageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const image = await createGalleryImage({
      ...parsed.data,
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

    const image = await updateGalleryImage(id, parsed.data);
    if (!image) {
      throw NotFoundError('Gallery image not found');
    }
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

    if (image.sourceType === 'local' && image.storageKey) {
      fs.rm(path.join(GALLERY_UPLOAD_DIR, image.storageKey), { force: true }, () => undefined);
    }
    // 'cloud' cleanup (deleteObject + deleteAsset) is handled by the storage-aware variant of
    // this same file, applied once the storage plugin is installed - without storage installed,
    // the CMS never offers a Cloud upload tab, so a 'cloud' record can't exist here in the first
    // place.

    await deleteGalleryImage(id);
    res.status(204).send();
  }),
);

export default router;
