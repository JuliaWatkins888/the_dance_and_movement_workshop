import { getProductRepository } from '@inithium/db';
import type { ProductEntity, ProductVariant } from '@inithium/db';
import type { PurchasableLineRef, PurchasableSource, ResolvedPurchasable } from './purchasable.contract';

export const PRODUCT_SOURCE_TYPE = 'product';

// The storefront merch page opens a product's detail dialog from this query parameter.
const productHref = (slug: string): string => `/merch?item=${encodeURIComponent(slug)}`;

// A variant must be named explicitly unless the product only has one (the "no options" case).
const selectVariant = (product: ProductEntity, variantId: string | undefined): ProductVariant | undefined =>
  variantId ? product.variants.find((variant) => variant.id === variantId) : product.variants.length === 1 ? product.variants[0] : undefined;

const variantLabel = (product: ProductEntity, variant: ProductVariant): string =>
  product.options
    .map((option) => variant.optionValues[option.name])
    .filter((value): value is string => Boolean(value))
    .join(' / ');

const findPurchasableVariant = async (ref: PurchasableLineRef) => {
  const product = await getProductRepository().findById(ref.sourceId);
  if (!product || !product.isPublished) return null;
  const variant = selectVariant(product, ref.variantId);
  if (!variant || !variant.isActive) return null;
  return { product, variant };
};

const productPurchasable: PurchasableSource = {
  sourceType: PRODUCT_SOURCE_TYPE,

  resolve: async (ref: PurchasableLineRef): Promise<ResolvedPurchasable | null> => {
    const found = await findPurchasableVariant(ref);
    if (!found) return null;
    const { product, variant } = found;
    const label = variantLabel(product, variant);

    return {
      name: label ? `${product.name} (${label})` : product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      href: productHref(product.slug),
      unitAmountCents: variant.priceCents ?? product.basePriceCents,
      categories: product.categories,
      taxCode: product.taxCode,
      requiresShipping: product.requiresShipping,
      maxQuantity: variant.stockQuantity ?? undefined,
      billing: product.billing,
    };
  },

  reserve: async (ref: PurchasableLineRef): Promise<boolean> => {
    const found = await findPurchasableVariant(ref);
    if (!found) return false;
    return getProductRepository().reserveVariantStock(found.product.id, found.variant.id, ref.quantity);
  },

  release: async (ref: PurchasableLineRef): Promise<void> => {
    const product = await getProductRepository().findById(ref.sourceId);
    const variant = product ? selectVariant(product, ref.variantId) : undefined;
    if (!product || !variant) return;
    await getProductRepository().releaseVariantStock(product.id, variant.id, ref.quantity);
  },
};

export default productPurchasable;
