import { useMemo, useState } from 'react';
import { Box, Button, Checkbox, Divider, IconButton, Input, Pill, RadioGroup, RadioGroupItem, Select, SelectItem, Switch, Text } from '@inithium/ui';
import {
  formatMinorUnitsForInput,
  parseMinorUnitsInput,
  readApiError,
  useCreateDiscountMutation,
  useListAllProductCategoriesQuery,
  useListDiscountSourceTypesQuery,
  useListProductsAdminQuery,
  useUpdateDiscountMutation,
} from '@inithium/api-client';
import type { DiscountDto, DiscountWriteInput } from '@inithium/api-client';
import type { DiscountBillingTarget, DiscountDuration, DiscountKind, DiscountScope } from '@inithium/db';
import { FormError, MoneyInput, TagInput, useStoreCurrency } from '../ecommerce/shared';

export interface DiscountEditDialogProps {
  readonly discount?: DiscountDto;
  readonly onDone: () => void;
  readonly onCancel: () => void;
}

const PRODUCT_LOOKUP_PAGE_SIZE = 100;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Unambiguous characters only (no 0/O, 1/I), so a code read aloud or off a flyer is typed right.
const generateCode = (): string =>
  Array.from({ length: 8 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

// <input type="datetime-local"> works in the viewer's local time without a zone suffix.
const toLocalInput = (iso?: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocalInput = (value: string): string | null => (value ? new Date(value).toISOString() : null);

const parseOptionalInt = (value: string): number | null | 'invalid' => {
  if (!value.trim()) return null;
  return /^\d+$/.test(value.trim()) && Number(value) > 0 ? Number(value) : 'invalid';
};

const SOURCE_TYPE_LABELS: Record<string, string> = { product: 'Products' };
const labelSourceType = (type: string): string => SOURCE_TYPE_LABELS[type] ?? `${type.charAt(0).toUpperCase()}${type.slice(1)}s`;

// Specific products an items-scoped code targets, picked by name.
const ProductTargetPicker = ({ selectedIds, onChange }: { readonly selectedIds: string[]; readonly onChange: (ids: string[]) => void }) => {
  const [search, setSearch] = useState('');
  const { data: allProducts } = useListProductsAdminQuery({ page: 1, pageSize: PRODUCT_LOOKUP_PAGE_SIZE });
  const { data: matches } = useListProductsAdminQuery(
    { page: 1, pageSize: 8, search: search.trim(), searchField: 'name' },
    { skip: search.trim().length < 2 },
  );
  const nameById = new Map((allProducts?.items ?? []).map((product) => [product.id, product.name]));
  (matches?.items ?? []).forEach((product) => nameById.set(product.id, product.name));

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Input label="Specific products" placeholder="Search products by name…" value={search} onChange={(event) => setSearch(event.target.value)} />
      {search.trim().length >= 2 && matches ? (
        <Box borderColor={{ color: 'surface', intensity: 300 }} className="rounded border">
          {matches.items.length === 0 ? (
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }} padding={{ base: 8 }} className="text-sm">
              No matching products.
            </Text>
          ) : (
            matches.items.map((product) => (
              <button
                key={product.id}
                type="button"
                disabled={selectedIds.includes(product.id)}
                onClick={() => {
                  onChange([...selectedIds, product.id]);
                  setSearch('');
                }}
                className="block w-full px-3 py-2 text-left text-sm text-surface-900 hover:bg-surface-200 disabled:opacity-50"
              >
                {product.name}
              </button>
            ))
          )}
        </Box>
      ) : null}
      {selectedIds.length > 0 ? (
        <Box flex={{ direction: 'row', wrap: 'wrap', gap: 8 }}>
          {selectedIds.map((id) => (
            <Pill key={id} color={{ color: 'surface', intensity: 200 }} className="gap-1 pr-1 text-surface-900">
              {nameById.get(id) ?? 'Unknown or deleted product'}
              <IconButton
                icon="X"
                label="Remove product"
                iconSize={12}
                variant={{ kind: 'ghost', color: 'surface' }}
                textColor={{ color: 'surface', intensity: 700 }}
                className="h-5 w-5 p-0"
                onClick={() => onChange(selectedIds.filter((candidate) => candidate !== id))}
              />
            </Pill>
          ))}
        </Box>
      ) : null}
    </Box>
  );
};

export const DiscountEditDialog = ({ discount, onDone, onCancel }: DiscountEditDialogProps) => {
  const currency = useStoreCurrency();
  const { data: categorySuggestions = [] } = useListAllProductCategoriesQuery();
  const { data: sourceTypes = [] } = useListDiscountSourceTypesQuery();
  const [createDiscount, { isLoading: isCreating }] = useCreateDiscountMutation();
  const [updateDiscount, { isLoading: isUpdating }] = useUpdateDiscountMutation();
  const isSaving = isCreating || isUpdating;

  const [code, setCode] = useState(discount?.code ?? '');
  const [description, setDescription] = useState(discount?.description ?? '');
  const [kind, setKind] = useState<DiscountKind>(discount?.kind ?? 'percent');
  const [percentValue, setPercentValue] = useState(discount?.kind === 'percent' ? String(discount.value) : '');
  const [fixedValue, setFixedValue] = useState(discount?.kind === 'fixed' ? formatMinorUnitsForInput(discount.value, currency) : '');
  const [scope, setScope] = useState<DiscountScope>(discount?.scope ?? 'order');
  const [targetCategories, setTargetCategories] = useState<string[]>(discount?.target.categories ?? []);
  const [targetProductIds, setTargetProductIds] = useState<string[]>(discount?.target.sourceIds ?? []);
  const [targetSourceTypes, setTargetSourceTypes] = useState<string[]>(discount?.target.sourceTypes ?? []);
  const [appliesToBilling, setAppliesToBilling] = useState<DiscountBillingTarget>(discount?.appliesToBilling ?? 'all');
  const [duration, setDuration] = useState<DiscountDuration>(discount?.duration ?? 'once');
  const [durationInMonths, setDurationInMonths] = useState(discount?.durationInMonths ? String(discount.durationInMonths) : '');
  const [minSubtotal, setMinSubtotal] = useState(formatMinorUnitsForInput(discount?.minSubtotalCents, currency));
  const [minQuantity, setMinQuantity] = useState(discount?.minQuantity ? String(discount.minQuantity) : '');
  const [maxRedemptions, setMaxRedemptions] = useState(discount?.maxRedemptions ? String(discount.maxRedemptions) : '');
  const [maxPerUser, setMaxPerUser] = useState(discount?.maxRedemptionsPerUser ? String(discount.maxRedemptionsPerUser) : '');
  const [startsAt, setStartsAt] = useState(toLocalInput(discount?.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(discount?.endsAt));
  const [isActive, setIsActive] = useState(discount?.isActive ?? true);
  const [error, setError] = useState<string | undefined>(undefined);

  const coversRecurring = appliesToBilling !== 'one_time';
  const summary = useMemo(() => {
    const amount = kind === 'percent' ? `${percentValue || '?'}% off` : `${fixedValue ? `${currency.toUpperCase()} ${fixedValue}` : '?'} off`;
    if (scope === 'order') return `${amount} the ${kind === 'fixed' ? 'order total' : 'whole order'}`;
    return `${amount} ${kind === 'fixed' ? 'each eligible item' : 'eligible items'}`;
  }, [kind, percentValue, fixedValue, scope, currency]);

  const handleSubmit = async () => {
    setError(undefined);
    if (!/^[A-Za-z0-9_-]{2,40}$/.test(code.trim())) return setError('The code must be 2-40 letters, numbers, hyphens, or underscores.');

    let value: number;
    if (kind === 'percent') {
      value = Number(percentValue);
      if (!Number.isInteger(value) || value < 1 || value > 100) return setError('Percent off must be a whole number from 1 to 100.');
    } else {
      const parsed = parseMinorUnitsInput(fixedValue, currency);
      if (parsed === null || parsed < 1) return setError('Enter a valid amount off.');
      value = parsed;
    }

    const minSubtotalCents = minSubtotal.trim() ? parseMinorUnitsInput(minSubtotal, currency) : null;
    if (minSubtotalCents === null && minSubtotal.trim()) return setError('Enter a valid minimum order amount.');
    const numbers = {
      minQuantity: parseOptionalInt(minQuantity),
      maxRedemptions: parseOptionalInt(maxRedemptions),
      maxRedemptionsPerUser: parseOptionalInt(maxPerUser),
      durationInMonths: coversRecurring && duration === 'repeating' ? parseOptionalInt(durationInMonths) : null,
    };
    if (Object.values(numbers).includes('invalid')) return setError('Limits and month counts must be whole numbers greater than zero.');
    if (coversRecurring && duration === 'repeating' && numbers.durationInMonths === null) return setError('Enter how many months the discount repeats.');

    const startsIso = fromLocalInput(startsAt);
    const endsIso = fromLocalInput(endsAt);
    if (startsIso && endsIso && endsIso <= startsIso) return setError('The end date must be after the start date.');

    const input: DiscountWriteInput = {
      code: code.trim().toUpperCase(),
      kind,
      value,
      scope,
      target:
        scope === 'items'
          ? { sourceTypes: targetSourceTypes, sourceIds: targetProductIds, categories: targetCategories }
          : { sourceTypes: [], sourceIds: [], categories: [] },
      appliesToBilling,
      duration: coversRecurring ? duration : 'once',
      isActive,
    };
    // Optional fields: omitted (create) or null (update) when empty.
    const optional = {
      description: description.trim() || null,
      durationInMonths: numbers.durationInMonths as number | null,
      minSubtotalCents,
      minQuantity: numbers.minQuantity as number | null,
      maxRedemptions: numbers.maxRedemptions as number | null,
      maxRedemptionsPerUser: numbers.maxRedemptionsPerUser as number | null,
      startsAt: startsIso,
      endsAt: endsIso,
    };

    try {
      if (discount) {
        await updateDiscount({ id: discount.id, ...input, ...optional }).unwrap();
      } else {
        const present = Object.fromEntries(Object.entries(optional).filter(([, entry]) => entry !== null)) as Partial<DiscountWriteInput>;
        await createDiscount({ ...input, ...present }).unwrap();
      }
      onDone();
    } catch (saveError) {
      setError(readApiError(saveError, 'Could not save this discount. Check the fields and try again.').message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 20 }}>
      <Box flex={{ direction: 'row', align: 'end', gap: 8 }}>
        <Input label="Code" required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className="flex-1" />
        <Button variant={{ kind: 'outlined', color: 'surface', intensity: 400 }} textColor={{ color: 'surface', intensity: 900 }} onClick={() => setCode(generateCode())}>
          Generate
        </Button>
      </Box>
      <Input label="Description (internal)" value={description} onChange={(event) => setDescription(event.target.value)} />

      <Divider color={{ color: 'surface', intensity: 300 }} />

      <Box className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <RadioGroup label="Discount type" value={kind} onValueChange={(next) => setKind(next as DiscountKind)}>
          <RadioGroupItem value="percent" label="Percentage off" />
          <RadioGroupItem value="fixed" label="Fixed amount off" />
        </RadioGroup>
        {kind === 'percent' ? (
          <Input label="Percent off" inputMode="numeric" required value={percentValue} onChange={(event) => setPercentValue(event.target.value)} />
        ) : (
          <MoneyInput label="Amount off" required currency={currency} value={fixedValue} onChange={setFixedValue} />
        )}
      </Box>

      <RadioGroup label="Applies to" value={scope} onValueChange={(next) => setScope(next as DiscountScope)}>
        <RadioGroupItem value="order" label="The whole order" />
        <RadioGroupItem value="items" label="Specific items" />
      </RadioGroup>

      {scope === 'items' ? (
        <Box
          borderColor={{ color: 'surface', intensity: 300 }}
          padding={{ base: 12 }}
          flex={{ direction: 'col', gap: 12 }}
          className="rounded-md border"
        >
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
            An item qualifies if it matches every list you fill in. Leave a list empty to not filter by it.
          </Text>
          {sourceTypes.length > 1 ? (
            <Box flex={{ direction: 'col', gap: 8 }}>
              <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
                Item types
              </Text>
              <Box flex={{ direction: 'row', wrap: 'wrap', gap: 16 }}>
                {sourceTypes.map((type) => (
                  <Checkbox
                    key={type}
                    label={labelSourceType(type)}
                    checked={targetSourceTypes.includes(type)}
                    onCheckedChange={(checked) =>
                      setTargetSourceTypes(checked === true ? [...targetSourceTypes, type] : targetSourceTypes.filter((candidate) => candidate !== type))
                    }
                  />
                ))}
              </Box>
            </Box>
          ) : null}
          <TagInput label="Categories" values={targetCategories} onChange={setTargetCategories} suggestions={categorySuggestions} />
          <ProductTargetPicker selectedIds={targetProductIds} onChange={setTargetProductIds} />
        </Box>
      ) : null}

      <Text as="p" textColor={{ color: 'surface', intensity: 800 }} className="text-sm font-medium">
        {summary}
      </Text>

      <Divider color={{ color: 'surface', intensity: 300 }} />

      <Box className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select label="Billing it applies to" value={appliesToBilling} onValueChange={(next) => setAppliesToBilling(next as DiscountBillingTarget)}>
          <SelectItem value="all">One-time and recurring items</SelectItem>
          <SelectItem value="one_time">One-time items only</SelectItem>
          <SelectItem value="recurring">Recurring items only</SelectItem>
        </Select>
        {coversRecurring ? (
          <Select label="On subscriptions, discount" value={duration} onValueChange={(next) => setDuration(next as DiscountDuration)}>
            <SelectItem value="once">The first charge only</SelectItem>
            <SelectItem value="repeating">A number of months</SelectItem>
            <SelectItem value="forever">Every renewal</SelectItem>
          </Select>
        ) : null}
        {coversRecurring && duration === 'repeating' ? (
          <Input label="Months" inputMode="numeric" value={durationInMonths} onChange={(event) => setDurationInMonths(event.target.value)} />
        ) : null}
      </Box>

      <Divider color={{ color: 'surface', intensity: 300 }} />

      <Box className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Starts" type="datetime-local" helperText="Blank = active immediately" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
        <Input label="Ends" type="datetime-local" helperText="Blank = never expires" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
        <MoneyInput label="Minimum order" currency={currency} value={minSubtotal} onChange={setMinSubtotal} helperText="Blank = no minimum" placeholder="" />
        <Input label="Minimum eligible items" inputMode="numeric" helperText="Blank = no minimum" value={minQuantity} onChange={(event) => setMinQuantity(event.target.value)} />
        <Input label="Total uses allowed" inputMode="numeric" helperText="Blank = unlimited" value={maxRedemptions} onChange={(event) => setMaxRedemptions(event.target.value)} />
        <Input label="Uses per customer" inputMode="numeric" helperText="Blank = unlimited" value={maxPerUser} onChange={(event) => setMaxPerUser(event.target.value)} />
      </Box>

      <Switch label="Active" checked={isActive} onCheckedChange={setIsActive} />
      {discount ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          {`Used ${discount.timesRedeemed} time${discount.timesRedeemed === 1 ? '' : 's'}. Changes apply to future orders; subscriptions already discounted keep their original terms.`}
        </Text>
      ) : null}

      <FormError message={error} />

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
