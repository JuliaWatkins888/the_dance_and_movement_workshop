import { useCallback, useState } from 'react';

export interface UseSelectionResult {
  readonly selectedIds: ReadonlySet<string>;
  readonly selectedCount: number;
  readonly isSelected: (id: string) => boolean;
  readonly toggle: (id: string) => void;
  readonly clear: () => void;
}

// Generic id-set selection tracking for a list - not tied to Users or any other entity, so any
// future bulk-action list (Pages, etc.) reuses this unchanged rather than re-deriving its own
// Set<string> bookkeeping.
export const useSelection = (): UseSelectionResult => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);
  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    toggle,
    clear,
  };
};
