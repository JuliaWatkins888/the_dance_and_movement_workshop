import { useState } from 'react';
import { Box, Button, Input, Text } from '@inithium/ui';
import { readApiError, useCreateDeskAccountMutation, useSearchDeskAccountsQuery } from '@inithium/api-client';
import type { DeskAccountDetailDto } from '@inithium/api-client';
import { FormError } from '../ecommerce/shared';
import { personName, useDebounced } from './deskShared';

const SEARCH_DEBOUNCE_MS = 300;

interface NewAccountFormProps {
  readonly initialSearch: string;
  readonly onCreated: (account: DeskAccountDetailDto) => void;
  readonly onCancel: () => void;
}

const NewAccountForm = ({ initialSearch, onCreated, onCancel }: NewAccountFormProps) => {
  const [createAccount, { isLoading }] = useCreateDeskAccountMutation();
  const looksLikeEmail = initialSearch.includes('@');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(looksLikeEmail ? initialSearch : '');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const submit = async () => {
    setError(undefined);
    if (!firstName.trim()) return setError('Enter a first name.');
    if (!email.trim()) return setError('An email address is required so the family can sign in later.');
    if (password && password.length < 8) return setError('A password needs at least 8 characters, or leave it blank.');
    try {
      onCreated(
        await createAccount({
          firstName: firstName.trim(),
          email: email.trim(),
          ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(password ? { password } : {}),
        }).unwrap(),
      );
    } catch (createError) {
      setError(readApiError(createError, 'Could not create the account.').message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 12 }} borderColor={{ color: 'surface', intensity: 300 }} padding={{ base: 16 }} className="rounded-md border">
      <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
        New family account
      </Text>
      <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="First name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        <Input label="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
        <Input label="Email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <Input label="Phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        <Input
          label="Password (optional)"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          helperText="Leave blank if the family won’t sign in yet. You can set one later in Users."
          className="sm:col-span-2"
        />
      </Box>
      <FormError message={error} />
      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={submit} disabled={isLoading}>
          {isLoading ? 'Creating…' : 'Create account'}
        </Button>
      </Box>
    </Box>
  );
};

interface AccountSectionProps {
  readonly account: DeskAccountDetailDto | undefined;
  readonly onSelect: (accountId: string | null) => void;
}

export const AccountSection = ({ account, onSelect }: AccountSectionProps) => {
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const debounced = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS);
  const { data: results = [], isFetching } = useSearchDeskAccountsQuery(debounced, { skip: debounced.length < 2 });

  if (account) {
    return (
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }} borderColor={{ color: 'surface', intensity: 300 }} padding={{ base: 12 }} className="rounded-md border">
        <Box flex={{ direction: 'col' }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
            {personName(account)}
          </Text>
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
            {[account.email, account.phone].filter(Boolean).join(' · ')}
          </Text>
        </Box>
        <Button variant={{ kind: 'link', color: 'accent' }} textColor={{ color: 'surface', intensity: 800 }} onClick={() => onSelect(null)}>
          Change
        </Button>
      </Box>
    );
  }

  if (isCreating) {
    return (
      <NewAccountForm
        initialSearch={search.trim()}
        onCreated={(created) => {
          setIsCreating(false);
          onSelect(created.id);
        }}
        onCancel={() => setIsCreating(false)}
      />
    );
  }

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Input
        label="Find the family"
        placeholder="Search by name, email or phone…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {debounced.length >= 2 ? (
        <Box borderColor={{ color: 'surface', intensity: 300 }} className="rounded border">
          {results.length === 0 ? (
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }} padding={{ base: 8 }} className="text-sm">
              {isFetching ? 'Searching…' : 'No matching accounts.'}
            </Text>
          ) : (
            results.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => onSelect(result.id)}
                className="block w-full px-3 py-2 text-left text-sm text-surface-900 hover:bg-surface-200"
              >
                {[personName(result), result.email, result.phone].filter(Boolean).join(' · ')}
              </button>
            ))
          )}
        </Box>
      ) : null}
      <Box>
        <Button variant={{ kind: 'outlined', color: 'primary' }} textColor={{ color: 'surface', intensity: 900 }} onClick={() => setIsCreating(true)}>
          New account
        </Button>
      </Box>
    </Box>
  );
};
