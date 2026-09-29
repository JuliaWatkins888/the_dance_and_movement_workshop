import { isValidObjectId } from 'mongoose';
import type { Model, QueryFilter } from 'mongoose';
import {
  CreateProductInput,
  FindManyProductsOptions,
  FindPublishedProductsOptions,
  ProductEntity,
  ProductOption,
  ProductRepository,
  ProductVariant,
  UpdateProductInput,
} from '../../contracts/product.contract';
import type { PaginatedResult } from '../../contracts/pagination.contract';
import { toUpdateOperations } from '../../utils/toUpdateOperations';
import { escapeRegExp } from '../../utils/escapeRegExp';
import { ProductDocument } from '../../schemas/product.schema';

const mapToProductEntity = (doc: ProductDocument): ProductEntity => {
  const plain = doc.toObject();
  return {
    id: doc._id.toString(),
    name: plain.name,
    slug: plain.slug,
    description: plain.description,
    categories: plain.categories ?? [],
    imageUrl: plain.imageUrl,
    imageSourceType: plain.imageSourceType,
    imageAssetId: plain.imageAssetId,
    imageStorageKey: plain.imageStorageKey,
    basePriceCents: plain.basePriceCents,
    taxCode: plain.taxCode,
    requiresShipping: plain.requiresShipping,
    billing:
      plain.billing?.type === 'recurring'
        ? { type: 'recurring', interval: plain.billing.interval, intervalCount: plain.billing.intervalCount }
        : { type: 'one_time' },
    options: ((plain.options ?? []) as ProductOption[]).map((option) => ({ name: option.name, values: option.values ?? [] })),
    variants: ((plain.variants ?? []) as ProductVariant[]).map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      optionValues: variant.optionValues ?? {},
      priceCents: variant.priceCents ?? undefined,
      stockQuantity: variant.stockQuantity ?? null,
      isActive: variant.isActive,
    })),
    isPublished: plain.isPublished,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

export const createMongoProductRepository = (model: Model<ProductDocument>): ProductRepository => ({
  findMany: async (options: FindManyProductsOptions): Promise<PaginatedResult<ProductEntity>> => {
    const { page, pageSize, search, searchField } = options;
    const filter: QueryFilter<ProductDocument> = {};
    if (search && searchField) {
      filter[searchField] = { $regex: escapeRegExp(search), $options: 'i' };
    }

    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      model.find(filter).sort({ name: 1 }).skip(skip).limit(pageSize).exec(),
      model.countDocuments(filter).exec(),
    ]);

    return { items: docs.map(mapToProductEntity), total, page, pageSize };
  },
  findPublished: async (options: FindPublishedProductsOptions): Promise<PaginatedResult<ProductEntity>> => {
    const { page, pageSize, category, search } = options;
    const filter: QueryFilter<ProductDocument> = { isPublished: true };
    if (category) filter.categories = category;
    if (search) filter.name = { $regex: escapeRegExp(search), $options: 'i' };

    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      model.find(filter).sort({ name: 1 }).skip(skip).limit(pageSize).exec(),
      model.countDocuments(filter).exec(),
    ]);

    return { items: docs.map(mapToProductEntity), total, page, pageSize };
  },
  listPublishedCategories: async (): Promise<string[]> => {
    const categories: string[] = await model.distinct('categories', { isPublished: true }).exec();
    return categories.filter(Boolean).sort((a, b) => a.localeCompare(b));
  },
  listAllCategories: async (): Promise<string[]> => {
    const categories: string[] = await model.distinct('categories').exec();
    return categories.filter(Boolean).sort((a, b) => a.localeCompare(b));
  },
  findById: async (id: string): Promise<ProductEntity | null> => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapToProductEntity(doc) : null;
  },
  findBySlug: async (slug: string): Promise<ProductEntity | null> => {
    const doc = await model.findOne({ slug }).exec();
    return doc ? mapToProductEntity(doc) : null;
  },
  create: async (input: CreateProductInput): Promise<ProductEntity> => {
    const doc = await model.create(input);
    return mapToProductEntity(doc);
  },
  update: async (id: string, input: UpdateProductInput): Promise<ProductEntity | null> => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findByIdAndUpdate(id, toUpdateOperations(input), { new: true, runValidators: true }).exec();
    return doc ? mapToProductEntity(doc) : null;
  },
  delete: async (id: string): Promise<boolean> => {
    if (!isValidObjectId(id)) return false;
    const result = await model.findByIdAndDelete(id).exec();
    return result !== null;
  },
  reserveVariantStock: async (productId: string, variantId: string, quantity: number): Promise<boolean> => {
    if (!isValidObjectId(productId)) return false;
    const unlimited = await model
      .exists({ _id: productId, variants: { $elemMatch: { id: variantId, stockQuantity: null } } })
      .exec();
    if (unlimited) return true;

    const result = await model
      .updateOne(
        { _id: productId, variants: { $elemMatch: { id: variantId, stockQuantity: { $gte: quantity } } } },
        { $inc: { 'variants.$.stockQuantity': -quantity } },
      )
      .exec();
    return result.modifiedCount === 1;
  },
  releaseVariantStock: async (productId: string, variantId: string, quantity: number): Promise<void> => {
    if (!isValidObjectId(productId)) return;
    await model
      .updateOne(
        { _id: productId, variants: { $elemMatch: { id: variantId, stockQuantity: { $ne: null } } } },
        { $inc: { 'variants.$.stockQuantity': quantity } },
      )
      .exec();
  },
});
