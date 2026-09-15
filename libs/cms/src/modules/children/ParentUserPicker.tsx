import { useEffect, useState } from 'react';
import { Box, Button, Input, Text } from '@inithium/ui';
import { useListChildParentCandidatesQuery } from '@inithium/api-client';
import type { ChildParentCandidate } from '@inithium/api-client';

export interface ParentUserPickerProps {
  readonly onSelect: (candidate: ChildParentCandidate) => void;
  readonly className?: string;
}

const SEARCH_DEBOUNCE_MS = 300;

const fullNameOf = (candidate: ChildParentCandidate): string =>
  candidate.lastName ? `${candidate.firstName} ${candidate.lastName}` : candidate.firstName;

// Search-then-click-a-row picker for choosing which user account a child gets linked to as its
// parent - copied from staff/UserPicker.tsx's own generic shape (that component's own comment
// already anticipated a second consumer needing this exact "search users eligible for X" pattern
// with a different candidate endpoint), retyped to ChildParentCandidate since parent-candidates
// isn't role-filtered or already-linked-excluded the way staff's user-candidates is.
export const ParentUserPicker = ({ onSelect, className }: ParentUserPickerProps) => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const { data: candidates, isLoading } = useListChildParentCandidatesQuery({ search: debouncedSearch || undefined });

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
              No users found.
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export interface LinkedParentFieldProps {
  readonly initialLabel?: string;
  readonly initialEmail?: string;
  readonly onSelect: (candidate: ChildParentCandidate) => void;
  readonly className?: string;
}

// Wraps ParentUserPicker with the "show the current link, or show the picker to change it"
// toggle - same factoring as staff/UserPicker.tsx's own LinkedUserField, for the identical reason
// (the dialog still owns the actual selected-candidate state for its own submit payload; this
// only owns the picking-vs-summary display toggle and what the summary shows).
export const LinkedParentField = ({ initialLabel, initialEmail, onSelect, className }: LinkedParentFieldProps) => {
  const [isPicking, setIsPicking] = useState(!initialLabel);
  const [label, setLabel] = useState(initialLabel ?? '');
  const [email, setEmail] = useState(initialEmail ?? '');

  const handleSelect = (candidate: ChildParentCandidate) => {
    setLabel(fullNameOf(candidate));
    setEmail(candidate.email);
    setIsPicking(false);
    onSelect(candidate);
  };

  return (
    <Box flex={{ direction: 'col', gap: 8 }} className={className}>
      <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
        Parent Account
      </Text>
      {isPicking ? (
        <ParentUserPicker onSelect={handleSelect} />
      ) : (
        <Box
          flex={{ direction: 'row', align: 'center', justify: 'between', gap: 12 }}
          borderColor={{ color: 'surface', intensity: 300 }}
          padding={{ base: 12 }}
          className="rounded-md border"
        >
          <Box flex={{ direction: 'col' }}>
            <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm font-medium">
              {label || 'No parent selected'}
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
