import { Box, Button, IconButton, Input, Switch, Text } from '@inithium/ui';
import type { ProductOptionDto } from '@inithium/api-client';
import { TagInput } from '../ecommerce/shared';

const MAX_OPTIONS = 3;

// Form state for one variant row. Amounts/stock stay strings while editing and are parsed on save.
export interface VariantRow {
  // Local React key - stable across edits even for rows that don't have a server id yet.
  key: string;
  // The server id of an existing variant; kept so cart lines pointing at it stay valid.
  id?: string;
  sku: string;
  optionValues: Record<string, string>;
  // Blank = the product's base price.
  price: string;
  // Blank = unlimited stock.
  stock: string;
  isActive: boolean;
}

let nextRowKey = 0;
export const newVariantRow = (optionValues: Record<string, string> = {}): VariantRow => ({
  key: `row-${nextRowKey++}`,
  sku: '',
  optionValues,
  price: '',
  stock: '',
  isActive: true,
});

export const variantLabel = (row: VariantRow, options: ProductOptionDto[]): string =>
  options.map((option) => row.optionValues[option.name]).filter(Boolean).join(' / ') || 'Default';

const sameCombination = (a: Record<string, string>, b: Record<string, string>, options: ProductOptionDto[]): boolean =>
  options.every((option) => a[option.name] === b[option.name]);

// Every combination of the options' values (Size x Color -> S/Black, S/Red, ...), reusing an
// existing row wherever the combination already exists so its id, SKU, price, and stock survive.
export const generateVariantRows = (options: ProductOptionDto[], existing: VariantRow[]): VariantRow[] => {
  const usable = options.filter((option) => option.name.trim() && option.values.length > 0);
  if (usable.length === 0) return [existing[0] ?? newVariantRow()].map((row) => ({ ...row, optionValues: {} }));

  const combinations = usable.reduce<Record<string, string>[]>(
    (acc, option) => acc.flatMap((combination) => option.values.map((value) => ({ ...combination, [option.name]: value }))),
    [{}],
  );
  return combinations.map(
    (combination) => existing.find((row) => sameCombination(row.optionValues, combination, usable)) ?? newVariantRow(combination),
  );
};

interface VariantsEditorProps {
  readonly options: ProductOptionDto[];
  readonly onOptionsChange: (options: ProductOptionDto[]) => void;
  readonly rows: VariantRow[];
  readonly onRowsChange: (rows: VariantRow[]) => void;
  readonly currency: string;
}

export const VariantsEditor = ({ options, onOptionsChange, rows, onRowsChange, currency }: VariantsEditorProps) => {
  const updateOption = (index: number, next: ProductOptionDto) => onOptionsChange(options.map((option, i) => (i === index ? next : option)));
  const updateRow = (key: string, patch: Partial<VariantRow>) =>
    onRowsChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const hasOptions = options.length > 0;

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'col', gap: 4 }}>
        <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
          Options &amp; variants
        </Text>
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
          Add options like Size or Color, then generate a variant for every combination. Each variant can have its own SKU,
          price, and stock.
        </Text>
      </Box>

      {options.map((option, index) => (
        <Box
          key={index}
          borderColor={{ color: 'surface', intensity: 300 }}
          padding={{ base: 12 }}
          flex={{ direction: 'col', gap: 8 }}
          className="rounded-md border"
        >
          <Box flex={{ direction: 'row', align: 'end', gap: 8 }}>
            <Input
              label="Option name"
              placeholder="Size"
              value={option.name}
              onChange={(event) => updateOption(index, { ...option, name: event.target.value })}
              className="flex-1"
            />
            <IconButton
              icon="Trash"
              label={`Remove option ${option.name || index + 1}`}
              textColor={{ color: 'red', intensity: 600 }}
              onClick={() => onOptionsChange(options.filter((_, i) => i !== index))}
            />
          </Box>
          <TagInput
            label="Values"
            placeholder="S, M, L…"
            values={option.values}
            onChange={(values) => updateOption(index, { ...option, values })}
          />
        </Box>
      ))}

      <Box flex={{ direction: 'row', wrap: 'wrap', gap: 8 }}>
        {options.length < MAX_OPTIONS ? (
          <Button
            variant={{ kind: 'outlined', color: 'surface', intensity: 400 }}
            textColor={{ color: 'surface', intensity: 900 }}
            onClick={() => onOptionsChange([...options, { name: '', values: [] }])}
          >
            Add option
          </Button>
        ) : null}
        <Button variant={{ kind: 'outlined', color: 'primary' }} onClick={() => onRowsChange(generateVariantRows(options, rows))}>
          {hasOptions ? 'Generate variants' : 'Reset to a single variant'}
        </Button>
      </Box>

      <Box borderColor={{ color: 'surface', intensity: 200 }} className="overflow-x-auto rounded border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-surface-200 text-surface-800">
            <tr>
              <th className="px-3 py-2 font-medium">Variant</th>
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">{`Price (${currency.toUpperCase()})`}</th>
              <th className="px-3 py-2 font-medium">Stock</th>
              <th className="px-3 py-2 font-medium">Active</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-surface-200 text-surface-950">
                <td className="px-3 py-2 font-medium">{variantLabel(row, options)}</td>
                <td className="px-3 py-2">
                  <Input aria-label="SKU" value={row.sku} onChange={(event) => updateRow(row.key, { sku: event.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <Input
                    aria-label="Price override"
                    placeholder="Base price"
                    inputMode="decimal"
                    value={row.price}
                    onChange={(event) => updateRow(row.key, { price: event.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    aria-label="Stock"
                    placeholder="Unlimited"
                    inputMode="numeric"
                    value={row.stock}
                    onChange={(event) => updateRow(row.key, { stock: event.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <Switch aria-label="Active" checked={row.isActive} onCheckedChange={(isActive) => updateRow(row.key, { isActive })} />
                </td>
                <td className="px-3 py-2 text-right">
                  {rows.length > 1 ? (
                    <IconButton
                      icon="Trash"
                      label={`Remove ${variantLabel(row, options)}`}
                      textColor={{ color: 'red', intensity: 600 }}
                      onClick={() => onRowsChange(rows.filter((candidate) => candidate.key !== row.key))}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
        Leave price blank to use the base price and stock blank for unlimited. Removing a variant makes it unavailable in any cart
        that holds it; past orders keep their own copy.
      </Text>
    </Box>
  );
};
