import { useEffect, useState } from 'react';
import { Box, Input, Pill, Text } from '@inithium/ui';
import { useListInstructorCandidatesQuery } from '@inithium/api-client';
import type { InstructorCandidate } from '@inithium/api-client';

export interface InstructorPickerProps {
  readonly selected: InstructorCandidate[];
  readonly onChange: (selected: InstructorCandidate[]) => void;
  readonly label?: string;
}

const SEARCH_DEBOUNCE_MS = 300;

// Multi-select variant of staff/UserPicker.tsx's search-then-click-a-row shape - selected
// instructors render as removable chips (the same chip-removal UX ClassEditDialog's TagListField
// already uses for free-text tags) above the searchable candidate list, and onChange appends/
// removes from the full selection rather than replacing a single value.
export const InstructorPicker = ({ selected, onChange, label = 'Instructors' }: InstructorPickerProps) => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const { data: candidates, isLoading } = useListInstructorCandidatesQuery({ search: debouncedSearch || undefined });
  const selectedIds = new Set(selected.map((instructor) => instructor.id));

  const addInstructor = (candidate: InstructorCandidate) => {
    if (selectedIds.has(candidate.id)) return;
    onChange([...selected, candidate]);
  };

  const removeInstructor = (id: string) => onChange(selected.filter((instructor) => instructor.id !== id));

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
        {label}
      </Text>

      {selected.length > 0 ? (
        <Box flex={{ direction: 'row', gap: 6 }} className="flex-wrap">
          {selected.map((instructor) => (
            <Pill key={instructor.id} color={{ color: 'surface', intensity: 200 }}>
              <span className="inline-flex items-center gap-1.5">
                {instructor.name}
                <button
                  type="button"
                  onClick={() => removeInstructor(instructor.id)}
                  aria-label={`Remove ${instructor.name}`}
                  className="text-surface-500 hover:text-red-600"
                >
                  ×
                </button>
              </span>
            </Pill>
          ))}
        </Box>
      ) : null}

      <Input placeholder="Search staff by name..." value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />

      <Box borderColor={{ color: 'surface', intensity: 300 }} className="max-h-40 overflow-y-auto rounded-md border">
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
              disabled={selectedIds.has(candidate.id)}
              onClick={() => addInstructor(candidate)}
              className="flex w-full items-center justify-between border-b border-surface-200 px-3 py-2 text-left last:border-b-0 hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm font-medium">
                {candidate.name}
              </Text>
              {selectedIds.has(candidate.id) ? (
                <Text as="span" textColor={{ color: 'surface', intensity: 500 }} className="text-xs">
                  Added
                </Text>
              ) : null}
            </button>
          ))
        ) : (
          <Box padding={{ base: 12 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
              No staff found.
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
