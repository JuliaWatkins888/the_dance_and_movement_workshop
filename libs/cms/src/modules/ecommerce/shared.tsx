import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Box, IconButton, Input, Pill, Text } from '@inithium/ui';
import { currencyFractionDigits, useGetStoreConfigQuery } from '@inithium/api-client';

// Shared pieces of the ecommerce CMS modules (products, orders, discounts, shipping,
// subscriptions).

export const useStoreCurrency = (): string => useGetStoreConfigQuery().data?.currency ?? 'usd';

export const DIALOG_WIDTH_WIDE = 'min(56rem, 94vw)';
export const DIALOG_WIDTH = 640;

export const fullNameOf = (person: { firstName: string; lastName?: string; email: string }): string =>
  [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email;

interface MoneyInputProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly currency: string;
  readonly required?: boolean;
  readonly error?: string;
  readonly helperText?: string;
  readonly placeholder?: string;
  readonly className?: string;
}

// A text field for an amount in major units ("45.50") - parse with parseMinorUnitsInput on save.
export const MoneyInput = ({ label, value, onChange, currency, required, error, helperText, placeholder, className }: MoneyInputProps) => (
  <Input
    label={`${label} (${currency.toUpperCase()})`}
    inputMode={currencyFractionDigits(currency) > 0 ? 'decimal' : 'numeric'}
    required={required}
    value={value}
    placeholder={placeholder ?? (currencyFractionDigits(currency) > 0 ? '0.00' : '0')}
    onChange={(event) => onChange(event.target.value)}
    error={Boolean(error)}
    {...(error ? { helperText: error } : helperText ? { helperText } : {})}
    className={className}
  />
);

interface TagInputProps {
  readonly label: string;
  readonly values: string[];
  readonly onChange: (values: string[]) => void;
  // Existing values offered as one-click chips (e.g. categories already in use).
  readonly suggestions?: string[];
  readonly placeholder?: string;
  readonly helperText?: string;
}

// Free-form list of short strings (categories, option values): Enter or comma adds, x removes.
export const TagInput = ({ label, values, onChange, suggestions = [], placeholder, helperText }: TagInputProps) => {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const value = raw.trim();
    if (!value || values.includes(value)) return;
    onChange([...values, value]);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(draft);
      setDraft('');
    } else if (event.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  const unused = suggestions.filter((suggestion) => !values.includes(suggestion));

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Input
        label={label}
        value={draft}
        placeholder={placeholder ?? 'Type and press Enter'}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          add(draft);
          setDraft('');
        }}
        {...(helperText ? { helperText } : {})}
      />
      {values.length > 0 ? (
        <Box flex={{ direction: 'row', wrap: 'wrap', gap: 8 }}>
          {values.map((value) => (
            <Pill key={value} color={{ color: 'surface', intensity: 200 }} className="gap-1 pr-1 text-surface-900">
              {value}
              <IconButton
                icon="X"
                label={`Remove ${value}`}
                iconSize={12}
                variant={{ kind: 'ghost', color: 'surface' }}
                textColor={{ color: 'surface', intensity: 700 }}
                className="h-5 w-5 p-0"
                onClick={() => onChange(values.filter((candidate) => candidate !== value))}
              />
            </Pill>
          ))}
        </Box>
      ) : null}
      {unused.length > 0 ? (
        <Box flex={{ direction: 'row', wrap: 'wrap', align: 'center', gap: 8 }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
            Add existing:
          </Text>
          {unused.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => add(suggestion)}
              className="rounded-full border border-surface-300 px-2 py-0.5 text-xs text-surface-800 hover:bg-surface-200"
            >
              {suggestion}
            </button>
          ))}
        </Box>
      ) : null}
    </Box>
  );
};

export const EmptyState = ({ message }: { readonly message: string }) => (
  <Box padding={{ base: 24 }}>
    <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
      {message}
    </Text>
  </Box>
);

export const FormError = ({ message }: { readonly message?: string }) =>
  message ? (
    <Text as="p" textColor={{ color: 'red', intensity: 600 }} className="text-sm">
      {message}
    </Text>
  ) : null;
