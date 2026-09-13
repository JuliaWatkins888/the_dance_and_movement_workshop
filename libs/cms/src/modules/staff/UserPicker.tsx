import { useEffect, useState } from 'react';
import { Box, Button, Input, Text } from '@inithium/ui';
import { useListStaffUserCandidatesQuery } from '@inithium/api-client';
import type { StaffUserCandidate } from '@inithium/api-client';

export interface UserPickerProps {
  readonly onSelect: (candidate: StaffUserCandidate) => void;
  readonly className?: string;
}

const SEARCH_DEBOUNCE_MS = 300;

const fullNameOf = (candidate: StaffUserCandidate): string =>
  candidate.lastName ? `${candidate.firstName} ${candidate.lastName}` : candidate.firstName;

// Generic "pick one of a small, permission-scoped set of user accounts" composite - the
// search-then-click-a-row shape mirrors this codebase's existing precedent for the same problem
// (UsersModule's own search+list, FriendsPanel's "Add Friends" tab) rather than a Select/Combobox
// dropdown, which no primitive here currently supports for async/server-searched options.
// Deliberately not staff-specific in its rendering (it only knows StaffUserCandidate's shape, not
// anything about staff records), so a future module needing the same "search users eligible for
// X, already-claimed ones filtered out server-side" shape can reuse it as-is.
export const UserPicker = ({ onSelect, className }: UserPickerProps) => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const { data: candidates, isLoading } = useListStaffUserCandidatesQuery({ search: debouncedSearch || undefined });

  return (
    <Box flex={{ direction: 'col', gap: 8 }} className={className}>
      <Input
        placeholder="Search by name or email..."
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
      />
      <Box borderColor={{ color: 'surface', intensity: 300 }} className="max-h-56 overflow-y-auto rounded-md border">
        {isLoading ? (
          <Box padding={{ base: 12 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
              Loading...
            </Text>
          </Box>
        ) : candidates && candidates.length > 0 ? (
          candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => onSelect(candidate)}
              className="flex w-full flex-col items-start gap-0.5 border-b border-surface-200 px-3 py-2 text-left last:border-b-0 hover:bg-surface-50"
            >
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm font-medium">
                {fullNameOf(candidate)}
              </Text>
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
                {candidate.email} · {candidate.role}
              </Text>
            </button>
          ))
        ) : (
          <Box padding={{ base: 12 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
              No eligible users found.
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export interface LinkedUserFieldProps {
  readonly initialLabel?: string;
  readonly initialEmail?: string;
  readonly onSelect: (candidate: StaffUserCandidate) => void;
  readonly className?: string;
}

// Wraps UserPicker with the "show the current link, or show the picker to change it" toggle both
// StaffEditDialog variants (plain and storage-aware) need identically - factored out here so that
// duplication lives in exactly one place instead of twice per dialog variant. The dialog still
// owns the actual selected-candidate state for its own submit payload; this only owns the
// picking-vs-summary display toggle and what the summary shows.
export const LinkedUserField = ({ initialLabel, initialEmail, onSelect, className }: LinkedUserFieldProps) => {
  const [isPicking, setIsPicking] = useState(!initialLabel);
  const [label, setLabel] = useState(initialLabel ?? '');
  const [email, setEmail] = useState(initialEmail ?? '');

  const handleSelect = (candidate: StaffUserCandidate) => {
    setLabel(fullNameOf(candidate));
    setEmail(candidate.email);
    setIsPicking(false);
    onSelect(candidate);
  };

  return (
    <Box flex={{ direction: 'col', gap: 8 }} className={className}>
      <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
        Linked User
      </Text>
      {isPicking ? (
        <UserPicker onSelect={handleSelect} />
      ) : (
        <Box
          flex={{ direction: 'row', align: 'center', justify: 'between', gap: 12 }}
          borderColor={{ color: 'surface', intensity: 300 }}
          padding={{ base: 12 }}
          className="rounded-md border"
        >
          <Box flex={{ direction: 'col' }}>
            <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm font-medium">
              {label || 'No user selected'}
            </Text>
            {email ? (
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
                {email}
              </Text>
            ) : null}
          </Box>
          <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={() => setIsPicking(true)}>
            Change
          </Button>
        </Box>
      )}
    </Box>
  );
};
