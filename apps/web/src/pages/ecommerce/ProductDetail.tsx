import { useEffect, useState } from 'react';
import { alert, Box, Button, Loader, Pill, Text, useNavigateWithTransition } from '@inithium/ui';
import {
  findSelectedVariant,
  formatBillingInterval,
  formatMoney,
  initialVariantSelection,
  isOptionValueAvailable,
  readApiError,
  useAddCartLineMutation,
  useGetProductBySlugQuery,
  variantPrice,
} from '@inithium/api-client';
import type { ProductDto, VariantSelection } from '@inithium/api-client';
import { useCurrentUser } from '../../app/useCurrentUser';
import { ProductImage } from './ProductImage';
import { QuantityStepper } from './QuantityStepper';
import { loginPathFor } from './SignInPrompt';
import { PRODUCT_SOURCE_TYPE, productHref } from './productLinks';

const ALERT_POSITION = 'bottom-right' as const;
const MAX_QUANTITY = 99;

interface OptionPickerProps {
  readonly product: ProductDto;
  readonly selection: VariantSelection;
  readonly onSelect: (optionName: string, value: string) => void;
}

// One row of buttons per option (Size, Color, ...). A value that can't lead to a purchasable
// variant given the other current choices is disabled rather than hidden, so the shopper can
// see the full range and what's sold out.
const OptionPicker = ({ product, selection, onSelect }: OptionPickerProps) => (
  <Box flex={{ direction: 'col', gap: 16 }}>
    {product.options.map((option) => (
      <Box key={option.name} flex={{ direction: 'col', gap: 8 }}>
        <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm font-medium">
          {option.name}
          {selection[option.name] ? (
            <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="font-normal">
              {`: ${selection[option.name]}`}
            </Text>
          ) : null}
        </Text>
        <div role="radiogroup" aria-label={option.name} className="flex flex-wrap gap-2">
          {option.values.map((value) => {
            const isSelected = selection[option.name] === value;
            const isAvailable = isOptionValueAvailable(product, selection, option.name, value);
            return (
              <Button
                key={value}
                role="radio"
                aria-checked={isSelected}
                disabled={!isAvailable && !isSelected}
                variant={isSelected ? { kind: 'filled', color: 'primary' } : { kind: 'outlined', color: 'surface', intensity: 400 }}
                textColor={isSelected ? { color: 'primary-foreground', intensity: 500 } : { color: 'surface', intensity: 900 }}
                className={!isAvailable ? 'line-through opacity-50' : undefined}
                onClick={() => onSelect(option.name, value)}
              >
                {value}
              </Button>
            );
          })}
        </div>
      </Box>
    ))}
  </Box>
);

interface ProductDetailProps {
  readonly slug: string;
  readonly currency: string;
  readonly close: () => void;
}

// The merch page's detail dialog content - everything about one product plus variant choice
// and add-to-cart. Opened from /merch?item=<slug>, so it's also linkable from a cart line.
export const ProductDetail = ({ slug, currency, close }: ProductDetailProps) => {
  const navigate = useNavigateWithTransition();
  const { currentUser } = useCurrentUser();
  const { data: product, isLoading, isError } = useGetProductBySlugQuery(slug);
  const [addCartLine, { isLoading: isAdding }] = useAddCartLineMutation();
  const [selection, setSelection] = useState<VariantSelection>({});
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (product) setSelection(initialVariantSelection(product));
  }, [product]);

  if (isLoading) {
    return (
      <Box flex={{ justify: 'center' }} padding={{ base: 48 }}>
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      </Box>
    );
  }
  if (isError || !product) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} padding={{ base: 24 }}>
        This item is no longer available.
      </Text>
    );
  }

  const variant = findSelectedVariant(product, selection);
  const stock = variant?.stockQuantity ?? null;
  const soldOut = variant !== undefined && stock !== null && stock <= 0;
  const maxQuantity = Math.max(1, Math.min(MAX_QUANTITY, stock ?? MAX_QUANTITY));
  const priceCents = variant ? variantPrice(product, variant) : product.basePriceCents;
  const intervalSuffix =
    product.billing.type === 'recurring' ? ` / ${formatBillingInterval(product.billing.interval, product.billing.intervalCount)}` : '';

  const selectOption = (optionName: string, value: string) => {
    setSelection((current) => ({ ...current, [optionName]: value }));
    setQuantity(1);
  };

  const handleAdd = async () => {
    if (!currentUser) {
      close();
      navigate(loginPathFor(productHref(product.slug)));
      return;
    }
    if (!variant) return;
    try {
      await addCartLine({ sourceType: PRODUCT_SOURCE_TYPE, sourceId: product.id, variantId: variant.id, quantity }).unwrap();
      alert.success(`${product.name} added to your cart.`, { position: ALERT_POSITION });
      close();
    } catch (error) {
      alert.danger(readApiError(error, 'Could not add this item to your cart.').message, { position: ALERT_POSITION });
    }
  };

  const addLabel = !currentUser ? 'Log in to add to cart' : soldOut ? 'Sold out' : !variant ? 'Choose an option' : 'Add to cart';

  return (
    <Box className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <Box className="aspect-square w-full overflow-hidden rounded-lg">
        <ProductImage src={product.imageUrl} alt={product.name} />
      </Box>

      <Box flex={{ direction: 'col', gap: 20 }}>
        <Box flex={{ direction: 'col', gap: 8 }}>
          <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
            {product.name}
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 950 }} className="text-xl font-semibold tabular-nums">
            {`${formatMoney(priceCents, currency)}${intervalSuffix}`}
          </Text>
          {product.categories.length > 0 ? (
            <Box flex={{ direction: 'row', wrap: 'wrap', gap: 8 }}>
              {product.categories.map((category) => (
                <Pill key={category} color={{ color: 'surface', intensity: 200 }} className="text-surface-800">
                  {category}
                </Pill>
              ))}
            </Box>
          ) : null}
        </Box>

        {product.description ? (
          <Text as="p" textColor={{ color: 'surface', intensity: 800 }} className="whitespace-pre-line text-sm leading-relaxed">
            {product.description}
          </Text>
        ) : null}

        {product.options.length > 0 ? <OptionPicker product={product} selection={selection} onSelect={selectOption} /> : null}

        {variant && stock !== null && stock > 0 && stock <= 5 ? (
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm font-medium">
            {`Only ${stock} left`}
          </Text>
        ) : null}

        <Box flex={{ direction: 'row', align: 'center', wrap: 'wrap', gap: 16 }}>
          {currentUser && variant && !soldOut ? (
            <QuantityStepper value={quantity} max={maxQuantity} onChange={setQuantity} disabled={isAdding} />
          ) : null}
          <Button
            variant={{ kind: 'filled', color: 'primary' }}
            disabled={isAdding || (Boolean(currentUser) && (!variant || soldOut))}
            onClick={handleAdd}
            className="flex-1"
          >
            {isAdding ? 'Adding…' : addLabel}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};
