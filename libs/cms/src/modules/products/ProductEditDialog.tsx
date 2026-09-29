import { useRef, useState } from 'react';
import { Box, Button, Divider, Input, RadioGroup, RadioGroupItem, Select, SelectItem, Switch, Text, Textarea } from '@inithium/ui';
import {
  formatMinorUnitsForInput,
  parseMinorUnitsInput,
  readApiError,
  useCreateProductMutation,
  useListAllProductCategoriesQuery,
  useUpdateProductMutation,
} from '@inithium/api-client';
import type { AdminProductDto, ProductBillingDto, ProductOptionDto, ProductVariantInput, ProductWriteInput } from '@inithium/api-client';
import type { BillingInterval } from '@inithium/db';
import { FormError, MoneyInput, TagInput, useStoreCurrency } from '../ecommerce/shared';
import { ProductImageField } from './ProductImageField';
import type { ProductImageFieldHandle } from './productImage.contract';
import { generateVariantRows, newVariantRow, VariantsEditor, variantLabel } from './VariantsEditor';
import type { VariantRow } from './VariantsEditor';

// Mirrors @inithium/db's BILLING_INTERVALS - the CMS only imports types from @inithium/db (a
// value import would pull the Node-side database driver into the browser bundle).
const BILLING_INTERVALS: BillingInterval[] = ['day', 'week', 'month', 'year'];

export interface ProductEditDialogProps {
  readonly product?: AdminProductDto;
  readonly onDone: () => void;
  readonly onCancel: () => void;
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toRows = (product: AdminProductDto | undefined, currency: string): VariantRow[] =>
  product && product.variants.length > 0
    ? product.variants.map((variant) => ({
        ...newVariantRow(variant.optionValues),
        id: variant.id,
        sku: variant.sku ?? '',
        price: formatMinorUnitsForInput(variant.priceCents, currency),
        stock: variant.stockQuantity === null ? '' : String(variant.stockQuantity),
        isActive: variant.isActive,
      }))
    : [newVariantRow()];

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const parseVariants = (rows: VariantRow[], options: ProductOptionDto[], currency: string): Parsed<ProductVariantInput[]> => {
  const variants: ProductVariantInput[] = [];
  for (const row of rows) {
    const label = variantLabel(row, options);
    const priceCents = row.price.trim() ? parseMinorUnitsInput(row.price, currency) : undefined;
    if (priceCents === null) return { ok: false, error: `"${label}" has an invalid price.` };
    const stockText = row.stock.trim();
    if (stockText && !/^\d+$/.test(stockText)) return { ok: false, error: `"${label}" stock must be a whole number (or blank for unlimited).` };
    variants.push({
      ...(row.id ? { id: row.id } : {}),
      ...(row.sku.trim() ? { sku: row.sku.trim() } : {}),
      optionValues: Object.fromEntries(options.map((option) => [option.name, row.optionValues[option.name] ?? ''])),
      ...(priceCents !== undefined ? { priceCents } : {}),
      stockQuantity: stockText ? Number(stockText) : null,
      isActive: row.isActive,
    });
  }
  return { ok: true, value: variants };
};

export const ProductEditDialog = ({ product, onDone, onCancel }: ProductEditDialogProps) => {
  const currency = useStoreCurrency();
  const { data: categorySuggestions = [] } = useListAllProductCategoriesQuery();
  const [createProduct, { isLoading: isCreating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: isUpdating }] = useUpdateProductMutation();
  const isSaving = isCreating || isUpdating;
  const imageFieldRef = useRef<ProductImageFieldHandle>(null);

  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(Boolean(product));
  const [description, setDescription] = useState(product?.description ?? '');
  const [categories, setCategories] = useState<string[]>(product?.categories ?? []);
  const [basePrice, setBasePrice] = useState(formatMinorUnitsForInput(product?.basePriceCents, currency));
  const [billingType, setBillingType] = useState<ProductBillingDto['type']>(product?.billing.type ?? 'one_time');
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(product?.billing.type === 'recurring' ? product.billing.interval : 'month');
  const [intervalCount, setIntervalCount] = useState(String(product?.billing.type === 'recurring' ? product.billing.intervalCount : 1));
  const [requiresShipping, setRequiresShipping] = useState(product?.requiresShipping ?? false);
  const [taxCode, setTaxCode] = useState(product?.taxCode ?? '');
  const [isPublished, setIsPublished] = useState(product?.isPublished ?? false);
  const [options, setOptions] = useState<ProductOptionDto[]>(product?.options ?? []);
  const [rows, setRows] = useState<VariantRow[]>(() => toRows(product, currency));
  const [error, setError] = useState<string | undefined>(undefined);

  const handleNameChange = (next: string) => {
    setName(next);
    if (!slugEdited) setSlug(slugify(next));
  };

  const handleSubmit = async () => {
    setError(undefined);
    if (!name.trim()) return setError('Name is required.');
    if (!slug.trim()) return setError('Slug is required.');
    const basePriceCents = parseMinorUnitsInput(basePrice, currency);
    if (basePriceCents === null) return setError('Enter a valid base price.');
    const cleanOptions = options
      .map((option) => ({ name: option.name.trim(), values: option.values }))
      .filter((option) => option.name && option.values.length > 0);
    if (cleanOptions.length !== options.length) return setError('Every option needs a name and at least one value (or remove it).');
    const count = Number(intervalCount);
    if (billingType === 'recurring' && (!Number.isInteger(count) || count < 1 || count > 12)) {
      return setError('Billing frequency must be a whole number from 1 to 12.');
    }

    // Keep the variant rows in step with the options if the admin changed options but didn't
    // regenerate - otherwise a variant could reference an option value that no longer exists.
    const syncedRows = cleanOptions.length > 0 || rows.some((row) => Object.keys(row.optionValues).length > 0)
      ? generateVariantRows(cleanOptions, rows)
      : rows;
    const variants = parseVariants(syncedRows, cleanOptions, currency);
    if (!variants.ok) return setError(variants.error);

    const image = (await imageFieldRef.current?.finalize()) ?? {};
    const input: ProductWriteInput = {
      name: name.trim(),
      slug: slug.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      categories,
      ...image,
      basePriceCents,
      ...(taxCode.trim() ? { taxCode: taxCode.trim() } : {}),
      requiresShipping,
      billing: billingType === 'recurring' ? { type: 'recurring', interval: billingInterval, intervalCount: count } : { type: 'one_time' },
      options: cleanOptions,
      variants: variants.value,
      isPublished,
    };

    try {
      if (product) {
        // An update only changes fields it sends, so anything the admin emptied is sent as null
        // (cleared) rather than left out (kept).
        await updateProduct({
          id: product.id,
          ...input,
          description: input.description ?? null,
          taxCode: input.taxCode ?? null,
          imageUrl: image.imageUrl ?? null,
          imageSourceType: image.imageSourceType ?? null,
          imageAssetId: image.imageAssetId ?? null,
          imageStorageKey: image.imageStorageKey ?? null,
        }).unwrap();
      } else {
        await createProduct(input).unwrap();
      }
      onDone();
    } catch (saveError) {
      setError(readApiError(saveError, 'Could not save this product. Check the fields and try again.').message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 20 }}>
      <Box className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Name" required value={name} onChange={(event) => handleNameChange(event.target.value)} />
        <Input
          label="Slug"
          required
          helperText="The product's URL: /merch?item=slug"
          value={slug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(slugify(event.target.value));
          }}
        />
      </Box>

      <Textarea label="Description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />

      <TagInput
        label="Categories"
        values={categories}
        onChange={setCategories}
        suggestions={categorySuggestions}
        helperText="Shoppers can filter by category; promo codes can target one."
      />

      <ProductImageField ref={imageFieldRef} initial={product ?? {}} />

      <Divider color={{ color: 'surface', intensity: 300 }} />

      <Box className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MoneyInput label="Base price" required currency={currency} value={basePrice} onChange={setBasePrice} />
        <Input
          label="Tax code"
          placeholder="txcd_99999999"
          helperText="Optional Stripe Tax product code. Blank uses your Stripe default."
          value={taxCode}
          onChange={(event) => setTaxCode(event.target.value)}
        />
      </Box>

      <Box flex={{ direction: 'col', gap: 12 }}>
        <RadioGroup label="Billing" value={billingType} onValueChange={(value) => setBillingType(value as ProductBillingDto['type'])}>
          <RadioGroupItem value="one_time" label="One-time purchase" />
          <RadioGroupItem value="recurring" label="Recurring subscription (first period charged at checkout)" />
        </RadioGroup>
        {billingType === 'recurring' ? (
          <Box flex={{ direction: 'row', align: 'end', gap: 12 }}>
            <Input
              label="Every"
              inputMode="numeric"
              value={intervalCount}
              onChange={(event) => setIntervalCount(event.target.value)}
              className="w-24"
            />
            <Select value={billingInterval} onValueChange={(value) => setBillingInterval(value as BillingInterval)} className="w-40">
              {BILLING_INTERVALS.map((candidate) => (
                <SelectItem key={candidate} value={candidate}>
                  {`${candidate}(s)`}
                </SelectItem>
              ))}
            </Select>
          </Box>
        ) : null}
      </Box>

      <Box flex={{ direction: 'row', wrap: 'wrap', gap: 24 }}>
        <Switch label="Ships to the customer" checked={requiresShipping} onCheckedChange={setRequiresShipping} />
        <Switch label="Published (visible in the store)" checked={isPublished} onCheckedChange={setIsPublished} />
      </Box>

      <Divider color={{ color: 'surface', intensity: 300 }} />

      <VariantsEditor options={options} onOptionsChange={setOptions} rows={rows} onRowsChange={setRows} currency={currency} />

      <FormError message={error} />
      {!product ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          New products start unpublished unless you turn on Published.
        </Text>
      ) : null}

      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};
