// Mirrors the backend product source (libs/ecommerce's product.purchasable.ts): its sourceType and
// the storefront link its resolved lines carry, which the products page turns into an open dialog.
export const PRODUCT_SOURCE_TYPE = 'product';
export const PRODUCT_QUERY_PARAM = 'item';

export const productHref = (slug: string): string => `/merch?${PRODUCT_QUERY_PARAM}=${encodeURIComponent(slug)}`;
