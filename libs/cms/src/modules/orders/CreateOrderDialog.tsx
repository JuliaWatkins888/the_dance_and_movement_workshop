import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Divider, IconButton, Input, Select, SelectItem, Text, Textarea } from '@inithium/ui';
import {
  formatMoney,
  isVariantPurchasable,
  readApiError,
  useCreateManualOrderMutation,
  useListProductsQuery,
  useListShippingMethodsAdminQuery,
  useQuoteManualOrderMutation,
  useSearchOrderCustomersQuery,
  variantPrice,
} from '@inithium/api-client';
import type {
  AdminOrderDto,
  CheckoutQuoteDto,
  ManualOrderInput,
  ManualOrderLineInput,
  PersonDto,
  PostalAddressInput,
  ProductDto,
} from '@inithium/api-client';
import { FormError, fullNameOf, useStoreCurrency } from '../ecommerce/shared';

const SEARCH_DEBOUNCE_MS = 300;
const QUOTE_DEBOUNCE_MS = 400;
const NO_SHIPPING = 'none';

const useDebounced = (value: string, delayMs: number): string => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
};

interface DraftLine {
  key: string;
  label: string;
  input: ManualOrderLineInput;
}

const CustomerPicker = ({ value, onChange }: { readonly value: PersonDto | null; readonly onChange: (next: PersonDto | null) => void }) => {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS);
  const { data: results = [], isFetching } = useSearchOrderCustomersQuery(debounced, { skip: debounced.length < 2 });

  if (value) {
    return (
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }} borderColor={{ color: 'surface', intensity: 300 }} padding={{ base: 12 }} className="rounded-md border">
        <Box flex={{ direction: 'col' }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
            {fullNameOf(value)}
          </Text>
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
            {value.email}
          </Text>
        </Box>
        <Button variant={{ kind: 'link', color: 'accent' }} textColor={{ color: 'surface', intensity: 800 }} onClick={() => onChange(null)}>
          Change
        </Button>
      </Box>
    );
  }

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Input label="Customer" required placeholder="Search by name or email…" value={search} onChange={(event) => setSearch(event.target.value)} />
      {debounced.length >= 2 ? (
        <Box borderColor={{ color: 'surface', intensity: 300 }} className="rounded border">
          {results.length === 0 ? (
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }} padding={{ base: 8 }} className="text-sm">
              {isFetching ? 'Searching…' : 'No matching customers. They need an account first.'}
            </Text>
          ) : (
            results.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => onChange(person)}
                className="block w-full px-3 py-2 text-left text-sm text-surface-900 hover:bg-surface-200"
              >
                {`${fullNameOf(person)} · ${person.email}`}
              </button>
            ))
          )}
        </Box>
      ) : null}
    </Box>
  );
};

const variantName = (product: ProductDto, variantId: string): string => {
  const variant = product.variants.find((candidate) => candidate.id === variantId);
  const label = variant ? product.options.map((option) => variant.optionValues[option.name]).filter(Boolean).join(' / ') : '';
  return label ? `${product.name} (${label})` : product.name;
};

// Adds store products to the order. Only published, one-time items are offered - a staff-created
// order can't start a subscription (there's no card on file to bill renewals).
const ItemPicker = ({ currency, onAdd }: { readonly currency: string; readonly onAdd: (line: DraftLine) => void }) => {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS);
  const { data } = useListProductsQuery({ page: 1, pageSize: 8, ...(debounced ? { search: debounced } : {}) });
  const [product, setProduct] = useState<ProductDto | null>(null);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');

  const products = (data?.items ?? []).filter((candidate) => candidate.billing.type === 'one_time');
  const variants = product ? product.variants.filter(isVariantPurchasable) : [];

  const choose = (next: ProductDto) => {
    setProduct(next);
    setVariantId(next.variants.filter(isVariantPurchasable)[0]?.id ?? '');
    setQuantity('1');
  };

  const add = () => {
    const count = Number(quantity);
    if (!product || !variantId || !Number.isInteger(count) || count < 1) return;
    onAdd({
      key: `${product.id}-${variantId}-${Date.now()}`,
      label: variantName(product, variantId),
      input: { sourceType: 'product', sourceId: product.id, variantId, quantity: count },
    });
    setProduct(null);
    setSearch('');
  };

  return (
    <Box borderColor={{ color: 'surface', intensity: 300 }} padding={{ base: 12 }} flex={{ direction: 'col', gap: 8 }} className="rounded-md border">
      {product ? (
        <Box flex={{ direction: 'row', wrap: 'wrap', align: 'end', gap: 8 }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="w-full font-medium">
            {product.name}
          </Text>
          {variants.length > 1 || product.options.length > 0 ? (
            <Select label="Variant" value={variantId} onValueChange={setVariantId} className="min-w-48 flex-1">
              {variants.map((variant) => (
                <SelectItem key={variant.id} value={variant.id}>
                  {`${variantName(product, variant.id)} · ${formatMoney(variantPrice(product, variant), currency)}`}
                </SelectItem>
              ))}
            </Select>
          ) : null}
          <Input label="Qty" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="w-20" />
          <Button variant={{ kind: 'filled', color: 'primary' }} disabled={!variantId} onClick={add}>
            Add
          </Button>
          <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={() => setProduct(null)}>
            Back
          </Button>
          {variants.length === 0 ? (
            <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="w-full text-sm">
              This product is sold out.
            </Text>
          ) : null}
        </Box>
      ) : (
        <>
          <Input aria-label="Search products" placeholder="Search products to add…" value={search} onChange={(event) => setSearch(event.target.value)} />
          {products.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => choose(candidate)}
              className="flex w-full justify-between rounded px-2 py-1.5 text-left text-sm text-surface-900 hover:bg-surface-200"
            >
              <span>{candidate.name}</span>
              <span className="tabular-nums text-surface-600">{formatMoney(candidate.basePriceCents, currency)}</span>
            </button>
          ))}
        </>
      )}
    </Box>
  );
};

const ADDRESS_FIELDS: { key: keyof PostalAddressInput; label: string; wide?: boolean }[] = [
  { key: 'name', label: 'Recipient name', wide: true },
  { key: 'line1', label: 'Address', wide: true },
  { key: 'line2', label: 'Apartment, suite, etc.', wide: true },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State / Province' },
  { key: 'postalCode', label: 'Postal code' },
  { key: 'country', label: 'Country (2-letter code)' },
];

const emptyAddress: PostalAddressInput = { name: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'US' };

const toAddressPayload = (address: PostalAddressInput): PostalAddressInput | undefined => {
  if (!address.line1.trim() || !address.city.trim() || !address.postalCode.trim() || address.country.trim().length !== 2) return undefined;
  return {
    line1: address.line1.trim(),
    city: address.city.trim(),
    postalCode: address.postalCode.trim(),
    country: address.country.trim().toUpperCase(),
    ...(address.name?.trim() ? { name: address.name.trim() } : {}),
    ...(address.line2?.trim() ? { line2: address.line2.trim() } : {}),
    ...(address.state?.trim() ? { state: address.state.trim() } : {}),
  };
};

interface CreateOrderDialogProps {
  readonly onCreated: (order: AdminOrderDto) => void;
  readonly onCancel: () => void;
}

export const CreateOrderDialog = ({ onCreated, onCancel }: CreateOrderDialogProps) => {
  const currency = useStoreCurrency();
  const { data: shippingMethods = [] } = useListShippingMethodsAdminQuery();
  const [quoteOrder] = useQuoteManualOrderMutation();
  const [createOrder, { isLoading: isCreating }] = useCreateManualOrderMutation();

  const [customer, setCustomer] = useState<PersonDto | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [discountCode, setDiscountCode] = useState('');
  const [shippingMethodId, setShippingMethodId] = useState(NO_SHIPPING);
  const [address, setAddress] = useState<PostalAddressInput>(emptyAddress);
  const [internalNotes, setInternalNotes] = useState('');
  const [quote, setQuote] = useState<CheckoutQuoteDto | null>(null);
  const [quoteError, setQuoteError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const method = shippingMethods.find((candidate) => candidate.id === shippingMethodId);
  const code = useDebounced(discountCode.trim(), QUOTE_DEBOUNCE_MS);

  const input = useMemo((): ManualOrderInput | null => {
    if (!customer || lines.length === 0) return null;
    const shippingAddress = method?.requiresAddress ? toAddressPayload(address) : undefined;
    return {
      customerUserId: customer.id,
      lines: lines.map((line) => line.input),
      ...(code ? { discountCode: code } : {}),
      ...(method ? { shippingMethodId: method.id } : {}),
      ...(shippingAddress ? { shippingAddress } : {}),
      ...(internalNotes.trim() ? { internalNotes: internalNotes.trim() } : {}),
    };
  }, [customer, lines, code, method, address, internalNotes]);

  // Re-price whenever what's being priced changes (notes/address don't affect totals).
  const pricingKey = input ? JSON.stringify({ c: input.customerUserId, l: input.lines, d: input.discountCode, s: input.shippingMethodId }) : '';
  useEffect(() => {
    if (!input) {
      setQuote(null);
      setQuoteError(undefined);
      return;
    }
    let cancelled = false;
    quoteOrder(input)
      .unwrap()
      .then((next) => {
        if (cancelled) return;
        setQuote(next);
        setQuoteError(undefined);
      })
      .catch((quoteFailure) => {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(readApiError(quoteFailure, 'This order can’t be priced.').message);
      });
    return () => {
      cancelled = true;
    };
    // pricingKey stands in for the input fields that affect the price.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingKey, quoteOrder]);

  const handleCreate = async () => {
    setError(undefined);
    if (!input) return setError('Choose a customer and add at least one item.');
    if (method?.requiresAddress && !input.shippingAddress) return setError('Enter a complete shipping address or choose no shipping.');
    try {
      onCreated(await createOrder(input).unwrap());
    } catch (createError) {
      setError(readApiError(createError, 'Could not create this order.').message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 20 }}>
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
        Record a purchase the customer already paid for outside the store (in person, by phone). No payment is collected and no tax is
        added; stock, promo codes, and anything the items do once purchased work as they do online.
      </Text>

      <CustomerPicker value={customer} onChange={setCustomer} />

      <Box flex={{ direction: 'col', gap: 8 }}>
        <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
          Items
        </Text>
        {lines.map((line) => (
          <Box key={line.key} flex={{ direction: 'row', justify: 'between', align: 'center', gap: 8 }}>
            <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm">
              {`${line.input.quantity} × ${line.label}`}
            </Text>
            <IconButton
              icon="Trash"
              label={`Remove ${line.label}`}
              textColor={{ color: 'red', intensity: 600 }}
              onClick={() => setLines(lines.filter((candidate) => candidate.key !== line.key))}
            />
          </Box>
        ))}
        <ItemPicker currency={currency} onAdd={(line) => setLines([...lines, line])} />
      </Box>

      <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Promo code" value={discountCode} onChange={(event) => setDiscountCode(event.target.value.toUpperCase())} />
        <Select label="Shipping" value={shippingMethodId} onValueChange={setShippingMethodId}>
          <SelectItem value={NO_SHIPPING}>No shipping</SelectItem>
          {shippingMethods
            .filter((candidate) => candidate.isActive)
            .map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id}>
                {`${candidate.name} · ${candidate.amountCents === 0 ? 'Free' : formatMoney(candidate.amountCents, currency)}`}
              </SelectItem>
            ))}
        </Select>
      </Box>

      {method?.requiresAddress ? (
        <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ADDRESS_FIELDS.map((field) => (
            <Input
              key={field.key}
              label={field.label}
              value={address[field.key] ?? ''}
              onChange={(event) => setAddress({ ...address, [field.key]: event.target.value })}
              className={field.wide ? 'sm:col-span-2' : undefined}
            />
          ))}
        </Box>
      ) : null}

      <Textarea label="Internal notes" helperText="e.g. how and when it was paid. Only visible to staff." rows={2} value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} />

      {quote ? (
        <Box bgColor={{ color: 'surface', intensity: 200 }} padding={{ base: 16 }} flex={{ direction: 'col', gap: 4 }} className="rounded-md">
          {[
            ['Subtotal', formatMoney(quote.subtotalCents, currency)],
            ...(quote.discountCents > 0 ? [[`Discount${quote.discount ? ` (${quote.discount.code})` : ''}`, `-${formatMoney(quote.discountCents, currency)}`]] : []),
            ...(quote.shippingMethod ? [[`Shipping (${quote.shippingMethod.name})`, formatMoney(quote.shippingCents, currency)]] : []),
          ].map(([label, value]) => (
            <Box key={label} flex={{ direction: 'row', justify: 'between' }}>
              <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
                {label}
              </Text>
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm tabular-nums">
                {value}
              </Text>
            </Box>
          ))}
          <Divider color={{ color: 'surface', intensity: 300 }} />
          <Box flex={{ direction: 'row', justify: 'between' }}>
            <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
              Total paid
            </Text>
            <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-bold tabular-nums">
              {formatMoney(quote.totalCents, currency)}
            </Text>
          </Box>
        </Box>
      ) : null}
      <FormError message={quoteError ?? error} />

      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onCancel} disabled={isCreating}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleCreate} disabled={isCreating || !quote}>
          {isCreating ? 'Creating…' : 'Create order'}
        </Button>
      </Box>
    </Box>
  );
};
