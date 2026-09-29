import { useEffect, useState } from 'react';
import { alert, Box, Button, Icon, IconButton, ListRow, Pagination, Pill, SearchFilterBar, Switch, Text, dialog } from '@inithium/ui';
import {
  formatBillingInterval,
  formatMoney,
  productPriceRange,
  readApiError,
  useDeleteProductMutation,
  useListProductsAdminQuery,
  useUpdateProductMutation,
} from '@inithium/api-client';
import type { AdminProductDto } from '@inithium/api-client';
import type { ProductSearchField } from '@inithium/db';
import { DIALOG_WIDTH_WIDE, EmptyState, useStoreCurrency } from '../ecommerce/shared';
import { ProductEditDialog } from './ProductEditDialog';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const ALERT_POSITION = 'bottom-right' as const;

const FIELD_OPTIONS: { value: ProductSearchField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'slug', label: 'Slug' },
];

const describeStock = (product: AdminProductDto): string => {
  const active = product.variants.filter((variant) => variant.isActive);
  if (active.some((variant) => variant.stockQuantity === null)) return 'Unlimited stock';
  const total = active.reduce((sum, variant) => sum + (variant.stockQuantity ?? 0), 0);
  return total === 0 ? 'Sold out' : `${total} in stock`;
};

const describePrice = (product: AdminProductDto, currency: string): string => {
  const { minCents, varies } = productPriceRange(product);
  const price = `${varies ? 'From ' : ''}${formatMoney(minCents, currency)}`;
  return product.billing.type === 'recurring' ? `${price} / ${formatBillingInterval(product.billing.interval, product.billing.intervalCount)}` : price;
};

export const ProductsAdminModule = () => {
  const currency = useStoreCurrency();
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState<ProductSearchField>('name');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);
  useEffect(() => setPage(1), [debouncedSearch, searchField]);

  const { data, isLoading } = useListProductsAdminQuery({
    page,
    pageSize: PAGE_SIZE,
    ...(debouncedSearch ? { search: debouncedSearch, searchField } : {}),
  });
  const [updateProduct] = useUpdateProductMutation();
  const [deleteProduct] = useDeleteProductMutation();

  const openEditor = (product?: AdminProductDto) => {
    const id = dialog.show(
      () => <ProductEditDialog product={product} onDone={() => dialog.close(id)} onCancel={() => dialog.close(id)} />,
      { title: product ? `Edit "${product.name}"` : 'New Product', width: DIALOG_WIDTH_WIDE },
    );
  };

  const togglePublished = async (product: AdminProductDto, isPublished: boolean) => {
    try {
      await updateProduct({ id: product.id, isPublished }).unwrap();
    } catch (error) {
      alert.danger(readApiError(error, 'Could not update this product.').message, { position: ALERT_POSITION });
    }
  };

  const handleDelete = async (product: AdminProductDto) => {
    const confirmed = await dialog.confirm({
      title: 'Delete this product?',
      description: `"${product.name}" will be removed from the store and from any cart holding it. Past orders keep their own copy. Unpublishing hides it without deleting. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    try {
      await deleteProduct(product.id).unwrap();
    } catch (error) {
      alert.danger(readApiError(error, 'Could not delete this product.').message, { position: ALERT_POSITION });
    }
  };

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Products
        </Text>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => openEditor()}>
          Add Product
        </Button>
      </Box>

      <SearchFilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchField={searchField}
        onSearchFieldChange={(value) => setSearchField(value as ProductSearchField)}
        fieldOptions={FIELD_OPTIONS}
        placeholder="Search products..."
      />

      <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 200 }} className="rounded border">
        {isLoading ? (
          <EmptyState message="Loading products..." />
        ) : data && data.items.length > 0 ? (
          data.items.map((product) => (
            <ListRow
              key={product.id}
              leading={
                product.imageUrl ? (
                  <img src={product.imageUrl} alt="" className="h-12 w-12 rounded object-cover" />
                ) : (
                  <Box bgColor={{ color: 'surface', intensity: 200 }} flex={{ align: 'center', justify: 'center' }} className="h-12 w-12 rounded">
                    <Icon name="Package" size={22} textColor={{ color: 'surface', intensity: 500 }} />
                  </Box>
                )
              }
              trailing={
                <>
                  <Switch
                    label="Published"
                    checked={product.isPublished}
                    onCheckedChange={(checked) => togglePublished(product, checked)}
                  />
                  <IconButton icon="PencilSimple" label={`Edit ${product.name}`} onClick={() => openEditor(product)} />
                  <IconButton
                    icon="Trash"
                    label={`Delete ${product.name}`}
                    textColor={{ color: 'red', intensity: 600 }}
                    onClick={() => handleDelete(product)}
                  />
                </>
              }
            >
              <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
                <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="truncate font-medium">
                  {product.name}
                </Text>
                {!product.isPublished ? (
                  <Pill color={{ color: 'surface', intensity: 200 }} className="text-surface-800">
                    Draft
                  </Pill>
                ) : null}
              </Box>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                {[describePrice(product, currency), describeStock(product), `${product.variants.length} variant${product.variants.length === 1 ? '' : 's'}`, ...product.categories].join(' · ')}
              </Text>
            </ListRow>
          ))
        ) : (
          <EmptyState message={debouncedSearch ? 'No products match your search.' : 'No products yet. Add your first one.'} />
        )}
      </Box>

      {data && data.totalPages > 1 ? <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};
