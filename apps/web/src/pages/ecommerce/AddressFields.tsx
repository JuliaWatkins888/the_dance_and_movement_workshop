import { Box, Input, Select, SelectItem } from '@inithium/ui';
import type { PostalAddressInput } from '@inithium/api-client';

// Countries offered at checkout. Tax and shipping only work for destinations the store is set up
// for (Stripe Tax registrations, shipping methods), so this is a short, editable list rather than
// every ISO country.
export const CHECKOUT_COUNTRIES: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
];

export const emptyAddress = (): PostalAddressInput => ({
  name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: CHECKOUT_COUNTRIES[0]?.code ?? 'US',
});

export type AddressErrors = Partial<Record<keyof PostalAddressInput, string>>;

export const validateAddress = (address: PostalAddressInput): AddressErrors => {
  const errors: AddressErrors = {};
  if (!address.name?.trim()) errors.name = 'Full name is required.';
  if (!address.line1.trim()) errors.line1 = 'Address is required.';
  if (!address.city.trim()) errors.city = 'City is required.';
  if (!address.postalCode.trim()) errors.postalCode = 'Postal code is required.';
  if (!address.country) errors.country = 'Country is required.';
  return errors;
};

export const isAddressComplete = (address: PostalAddressInput): boolean => Object.keys(validateAddress(address)).length === 0;

// Trims the form's values and drops empty optional fields before the address goes to the API.
export const toAddressPayload = (address: PostalAddressInput): PostalAddressInput => ({
  line1: address.line1.trim(),
  city: address.city.trim(),
  postalCode: address.postalCode.trim(),
  country: address.country,
  ...(address.name?.trim() ? { name: address.name.trim() } : {}),
  ...(address.line2?.trim() ? { line2: address.line2.trim() } : {}),
  ...(address.state?.trim() ? { state: address.state.trim() } : {}),
});

interface AddressFieldsProps {
  readonly idPrefix: string;
  readonly value: PostalAddressInput;
  readonly onChange: (next: PostalAddressInput) => void;
  readonly errors?: AddressErrors;
  readonly disabled?: boolean;
}

export const AddressFields = ({ idPrefix, value, onChange, errors = {}, disabled }: AddressFieldsProps) => {
  const field = (key: keyof PostalAddressInput) => ({
    id: `${idPrefix}-${key}`,
    value: value[key] ?? '',
    disabled,
    error: Boolean(errors[key]),
    ...(errors[key] ? { helperText: errors[key] } : {}),
    onChange: (event: { target: { value: string } }) => onChange({ ...value, [key]: event.target.value }),
  });

  return (
    <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Input label="Full name" required autoComplete="name" className="sm:col-span-2" {...field('name')} />
      <Input label="Address" required autoComplete="address-line1" className="sm:col-span-2" {...field('line1')} />
      <Input label="Apartment, suite, etc." autoComplete="address-line2" className="sm:col-span-2" {...field('line2')} />
      <Input label="City" required autoComplete="address-level2" {...field('city')} />
      <Input label="State / Province" autoComplete="address-level1" {...field('state')} />
      <Input label="Postal code" required autoComplete="postal-code" {...field('postalCode')} />
      <Select
        label="Country"
        required
        value={value.country}
        onValueChange={(country) => onChange({ ...value, country })}
        disabled={disabled}
      >
        {CHECKOUT_COUNTRIES.map((country) => (
          <SelectItem key={country.code} value={country.code}>
            {country.name}
          </SelectItem>
        ))}
      </Select>
    </Box>
  );
};
