import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, ConflictError, createSuccessResponse, NotFoundError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { getProductRepository } from '@inithium/db';
import type { ProductSearchField, ProductVariant } from '@inithium/db';
import { createProductSchema, updateProductSchema } from '../../schemas/ecommerce.schema';
import { releaseCloudAsset, releaseReplacedCloudAsset, resolveCloudAssetUrl } from '../../services/cloud-image.service';
import { normalizeParam, paginatedResponse, parseBody, parsePaging, queryString } from './ecommerceHttp';

const router: RouterType = Router();
const MANAGE = 'ecommerce:manage-products';

const SEARCH_FIELDS = ['name', 'slug'] as const;
const isSearchField = (value: unknown): value is ProductSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

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
  '/api/products',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(createProductSchema, req.body);
    if (await getProductRepository().findBySlug(body.slug)) throw ConflictError('A product with this slug already exists');

    const product = await getProductRepository().create({
      ...body,
      ...(body.imageSourceType === 'cloud' && body.imageAssetId ? { imageUrl: await resolveCloudAssetUrl(body.imageAssetId) } : {}),
      variants: normalizeVariants(body.variants),
    });
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

    const previous = await getProductRepository().findById(id);
    if (!previous) throw NotFoundError('Product not found');

    // imageSourceType present (a value or null) means the image was changed or removed.
    const { variants, imageAssetId, ...rest } = body;
    const isImageChange = rest.imageSourceType !== undefined;
    const nextAssetId = isImageChange ? (rest.imageSourceType === 'cloud' ? imageAssetId : null) : previous.imageAssetId;
    const product = await getProductRepository().update(id, {
      ...rest,
      ...(isImageChange ? { imageAssetId: nextAssetId ?? null } : {}),
      ...(isImageChange && nextAssetId ? { imageUrl: await resolveCloudAssetUrl(nextAssetId) } : {}),
      ...(variants !== undefined ? { variants: normalizeVariants(variants) } : {}),
    });
    if (!product) throw NotFoundError('Product not found');
    await releaseReplacedCloudAsset(previous.imageAssetId, nextAssetId);
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

    await releaseCloudAsset(product.imageAssetId);
    await getProductRepository().delete(id);
    res.status(204).send();
  }),
);

export default router;
