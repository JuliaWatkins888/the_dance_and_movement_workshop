import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, dialog, Input, Loader, Pagination, Text } from '@inithium/ui';
import { useGetStoreConfigQuery, useListProductCategoriesQuery, useListProductsQuery } from '@inithium/api-client';
import type { ProductDto } from '@inithium/api-client';
import { ProductCard } from './ecommerce/ProductCard';
import { ProductDetail } from './ecommerce/ProductDetail';
import { PRODUCT_QUERY_PARAM } from './ecommerce/productLinks';

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;

const useDebouncedValue = (value: string, delayMs: number): string => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
};

// The product detail dialog is driven entirely by the `?item=<slug>` query parameter: opening a
// card sets it, closing the dialog clears it, and landing on the URL (a shared link, a cart line
// title, the browser's back/forward buttons) opens or closes the dialog to match.
const useProductDialog = (currency: string | undefined) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const slug = searchParams.get(PRODUCT_QUERY_PARAM);

  useEffect(() => {
    if (!slug || !currency) return;
    const dialogId = dialog.show(({ close }) => <ProductDetail slug={slug} currency={currency} close={close} />, {
      width: 'min(64rem, 92vw)',
      onClose: () =>
        setSearchParams(
          (current) => {
            // Only clear our own slug - a different product may have been opened meanwhile.
            if (current.get(PRODUCT_QUERY_PARAM) === slug) current.delete(PRODUCT_QUERY_PARAM);
            return current;
          },
          { replace: true },
        ),
    });
    return () => dialog.close(dialogId);
  }, [slug, currency, setSearchParams]);

  return (product: ProductDto) =>
    setSearchParams((current) => {
      current.set(PRODUCT_QUERY_PARAM, product.slug);
      return current;
    });
};

export const ProductsPage = () => {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);

  const { data: storeConfig } = useGetStoreConfigQuery();
  const { data: categories = [] } = useListProductCategoriesQuery();
  const { data, isLoading, isFetching } = useListProductsQuery({
    page,
    pageSize: PAGE_SIZE,
    ...(category ? { category } : {}),
    ...(search ? { search } : {}),
  });
  const currency = storeConfig?.currency;
  const openProduct = useProductDialog(currency);

  useEffect(() => setPage(1), [category, search]);

  const products = data?.items ?? [];

  return (
    <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }}>
      <Box flex={{ direction: 'col', gap: 4 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-3xl font-bold">
          Merch
        </Text>
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
          Browse studio merch available to purchase.
        </Text>
      </Box>

      <Box flex={{ direction: 'col', gap: 12 }} className="md:flex-row md:items-center md:justify-between">
        <Box flex={{ direction: 'row', wrap: 'wrap', gap: 8 }}>
          {categories.length > 0 ? (
            <Button
              variant={!category ? { kind: 'filled', color: 'primary' } : { kind: 'outlined', color: 'surface', intensity: 400 }}
              textColor={!category ? { color: 'primary-foreground', intensity: 500 } : { color: 'surface', intensity: 900 }}
              onClick={() => setCategory(undefined)}
            >
              All
            </Button>
          ) : null}
          {categories.map((candidate) => (
            <Button
              key={candidate}
              variant={category === candidate ? { kind: 'filled', color: 'primary' } : { kind: 'outlined', color: 'surface', intensity: 400 }}
              textColor={category === candidate ? { color: 'primary-foreground', intensity: 500 } : { color: 'surface', intensity: 900 }}
              onClick={() => setCategory(candidate)}
            >
              {candidate}
            </Button>
          ))}
        </Box>
        <Input
          aria-label="Search merch"
          placeholder="Search merch…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="md:w-72"
        />
      </Box>

      {isLoading || !currency ? (
        <Box flex={{ justify: 'center' }} padding={{ base: 48 }}>
          <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
        </Box>
      ) : products.length === 0 ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="py-12 text-center">
          {search || category ? 'No merch matches your filters.' : 'There is no merch available yet.'}
        </Text>
      ) : (
        <Box className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${isFetching ? 'opacity-60' : ''}`}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} currency={currency} onOpen={openProduct} />
          ))}
        </Box>
      )}

      {data && data.totalPages > 1 ? <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};

export default ProductsPage;
