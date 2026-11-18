import { Box, Input } from '@inithium/ui';
import type { PostalAddressInput } from '@inithium/api-client';

const ADDRESS_FIELDS: { key: keyof PostalAddressInput; label: string; wide?: boolean }[] = [
  { key: 'name', label: 'Full name', wide: true },
  { key: 'line1', label: 'Address', wide: true },
  { key: 'line2', label: 'Apartment, suite, etc.', wide: true },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State / Province' },
  { key: 'postalCode', label: 'Postal code' },
  { key: 'country', label: 'Country (2-letter code)' },
];

export const emptyAddress: PostalAddressInput = { name: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'US' };

// The address as the API wants it, or undefined while a required part is still missing.
export const toAddressPayload = (address: PostalAddressInput): PostalAddressInput | undefined => {
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

interface AddressInputsProps {
  readonly value: PostalAddressInput;
  readonly onChange: (next: PostalAddressInput) => void;
  readonly nameLabel?: string;
}

export const AddressInputs = ({ value, onChange, nameLabel }: AddressInputsProps) => (
  <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {ADDRESS_FIELDS.map((field) => (
      <Input
        key={field.key}
        label={field.key === 'name' && nameLabel ? nameLabel : field.label}
        value={value[field.key] ?? ''}
        onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
        className={field.wide ? 'sm:col-span-2' : undefined}
      />
    ))}
  </Box>
);
