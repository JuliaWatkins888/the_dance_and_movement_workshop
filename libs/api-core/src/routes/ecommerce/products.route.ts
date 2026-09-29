import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import type { NextFunction, Request, Response, Router as RouterType } from 'express';
import multer from 'multer';
import { asyncHandler, ConflictError, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { getProductRepository } from '@inithium/db';
import type { ProductSearchField, ProductVariant } from '@inithium/db';
import { createProductSchema, updateProductSchema } from '../../schemas/ecommerce.schema';
import { normalizeParam, paginatedResponse, parseBody, parsePaging, queryString } from './ecommerceHttp';

const router: RouterType = Router();
const MANAGE = 'ecommerce:manage-products';

// Same committed-to-git, outside-dist upload directory convention as the staff/gallery routes.
const PRODUCT_UPLOAD_DIR = path.resolve(process.cwd(), 'apps/api/uploads/products');
fs.mkdirSync(PRODUCT_UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
// No image/svg+xml - an uploaded SVG can carry <script> (stored XSS once rendered).
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const SEARCH_FIELDS = ['name', 'slug'] as const;
const isSearchField = (value: unknown): value is ProductSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, PRODUCT_UPLOAD_DIR),
    filename: (_req, file, callback) => callback(null, `${randomUUID()}.${EXTENSION_BY_MIME_TYPE[file.mimetype] ?? 'bin'}`),
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

const resolvePublicOrigin = (): string => process.env['API_PUBLIC_URL'] || `http://localhost:${process.env['PORT'] || 3000}`;

type VariantInput = Omit<ProductVariant, 'id'> & { id?: string };

// Keeps ids the client sent back (cart lines and orders reference them) and mints ids only for new
// variants. A product with no variants gets one default variant, so every line has one to point at.
const normalizeVariants = (variants: VariantInput[] | undefined): ProductVariant[] => {
  const list = variants && variants.length > 0 ? variants : [{ optionValues: {}, stockQuantity: null, isActive: true }];
  return list.map((variant) => ({ ...variant, id: variant.id ?? randomUUID() }));
};

router.get(
  '/api/products',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, pageSize } = parsePaging(req, 12);
    const category = queryString(req, 'category');
    const search = queryString(req, 'search');
    const result = await getProductRepository().findPublished({
      page,
      pageSize,
      ...(category ? { category } : {}),
      ...(search ? { search } : {}),
    });
    res.status(200).json(paginatedResponse(result, result.items));
  }),
);

router.get(
  '/api/products/categories',
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await getProductRepository().listPublishedCategories()));
  }),
);

// Literal segments registered ahead of "/api/products/:id" - Express matches in order.
router.get(
  '/api/products/admin',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, pageSize } = parsePaging(req);
    const search = queryString(req, 'search');
    const rawSearchField = req.query['searchField'];
    const result = await getProductRepository().findMany({
      page,
      pageSize,
      ...(search ? { search, searchField: isSearchField(rawSearchField) ? rawSearchField : 'name' } : {}),
    });
    res.status(200).json(paginatedResponse(result, result.items));
  }),
);

router.get(
  '/api/products/admin/categories',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await getProductRepository().listAllCategories()));
  }),
);

router.get(
  '/api/products/admin/:id',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const product = await getProductRepository().findById(normalizeParam(req.params['id']));
    if (!product) throw NotFoundError('Product not found');
    res.status(200).json(createSuccessResponse(product));
  }),
);

router.get(
  '/api/products/slug/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const product = await getProductRepository().findBySlug(normalizeParam(req.params['slug']));
    if (!product || !product.isPublished) throw NotFoundError('Product not found');
    res.status(200).json(createSuccessResponse(product));
  }),
);

router.post(
  '/api/products/upload',
  requireAuth,
  requirePermission(MANAGE),
  handleUpload,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ValidationError('No file was uploaded');
    res.status(201).json(
      createSuccessResponse({
        url: `${resolvePublicOrigin()}/api/products/uploads/${req.file.filename}`,
        storageKey: req.file.filename,
      }),
    );
  }),
);

router.use('/api/products/uploads', express.static(PRODUCT_UPLOAD_DIR));

router.post(
  '/api/products',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(createProductSchema, req.body);
    if (await getProductRepository().findBySlug(body.slug)) throw ConflictError('A product with this slug already exists');

    const product = await getProductRepository().create({ ...body, variants: normalizeVariants(body.variants) });
    res.status(201).json(createSuccessResponse(product));
  }),
);

router.put(
  '/api/products/:id',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params['id']);
    const body = parseBody(updateProductSchema, req.body);

    if (body.slug) {
      const existing = await getProductRepository().findBySlug(body.slug);
      if (existing && existing.id !== id) throw ConflictError('A product with this slug already exists');
    }

    const { variants, ...rest } = body;
    const product = await getProductRepository().update(id, {
      ...rest,
      ...(variants !== undefined ? { variants: normalizeVariants(variants) } : {}),
    });
    if (!product) throw NotFoundError('Product not found');
    res.status(200).json(createSuccessResponse(product));
  }),
);

router.delete(
  '/api/products/:id',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params['id']);
    const product = await getProductRepository().findById(id);
    if (!product) throw NotFoundError('Product not found');

    if (product.imageSourceType === 'local' && product.imageStorageKey) {
      fs.rm(path.join(PRODUCT_UPLOAD_DIR, product.imageStorageKey), { force: true }, () => undefined);
    }
    // 'cloud' cleanup (deleteObject + deleteAsset) lives in the storage-aware variant of this file,
    // applied once the storage plugin is installed - without it a 'cloud' image can't exist.

    await getProductRepository().delete(id);
    res.status(204).send();
  }),
);

export default router;
