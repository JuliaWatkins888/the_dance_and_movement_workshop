import type { ReactNode } from 'react';
import { Box, Checkbox } from '../components';
import { mergeClassNames } from '../theme/mergeClassNames';

export interface ListRowProps {
  readonly leading?: ReactNode;
  readonly children: ReactNode;
  readonly trailing?: ReactNode;
  // Renders a leading checkbox (before `leading`) when provided - omitted entirely means no
  // selection UI at all, so non-selectable lists are unaffected.
  readonly selected?: boolean;
  readonly onSelectedChange?: (selected: boolean) => void;
  readonly className?: string;
}

// A generic row shell - zero knowledge of what entity it's displaying. Deliberately not a full
// data-table abstraction: with only one real consumer (Users) so far, guessing at a generic
// column/schema shape now would be designing blind. Revisit if/when a second list (Pages) needs
// one and a real reusable shape becomes visible.
export const ListRow = ({ leading, children, trailing, selected, onSelectedChange, className }: ListRowProps) => (
  <Box
    flex={{ direction: 'row', align: 'center', gap: 12 }}
    borderColor={{ color: 'surface', intensity: 200 }}
    padding={{ base: 12 }}
    className={mergeClassNames('w-full border-b last:border-b-0 hover:bg-surface-50', className)}
  >
    {onSelectedChange ? (
      <Box flex={{ direction: 'row', align: 'center' }} className="shrink-0">
        <Checkbox checked={selected} onCheckedChange={(checked) => onSelectedChange(checked === true)} />
      </Box>
    ) : null}
    {leading ? (
      <Box flex={{ direction: 'row', align: 'center' }} className="shrink-0">
        {leading}
      </Box>
    ) : null}
    <Box flex={{ direction: 'col', gap: 2 }} className="min-w-0 flex-1">
      {children}
    </Box>
    {trailing ? (
      <Box flex={{ direction: 'row', align: 'center', gap: 8 }} className="shrink-0">
        {trailing}
      </Box>
    ) : null}
  </Box>
);
