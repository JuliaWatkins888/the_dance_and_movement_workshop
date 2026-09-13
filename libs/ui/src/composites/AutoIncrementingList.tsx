import { useRef, useState, type ReactNode } from 'react';
import { Box, Button, Icon } from '../components';
import { mergeClassNames } from '../theme/mergeClassNames';

export interface AutoIncrementingListProps {
  // Called once per row to produce that row's content - generic on purpose, so this composite
  // works for a column of anything (a ColorPicker, an Input, a whole card), not just one
  // specific component. `id` is stable across re-renders/reorders (see below); `index` is its
  // current position, handy for a per-row label like "Color #2".
  readonly renderItem: (index: number, id: string) => ReactNode;
  readonly initialCount?: number;
  // Floor the list can't shrink below - the last row still standing never shows a minus once
  // the list is at this count, mirroring the plus-only initial render.
  readonly minCount?: number;
  readonly gap?: number;
  readonly className?: string;
}

const DEFAULT_INITIAL_COUNT = 1;
const DEFAULT_MIN_COUNT = 1;
const DEFAULT_GAP = 12;

// A column of N instances of whatever `renderItem` produces, growing/shrinking under its own
// plus/minus controls: only the last row shows the plus (it's the one that grows the list, and
// it always has one, even at minCount); every row shows a minus once the list is above
// minCount, so a row loses its plus - but keeps or gains a minus - the moment it stops being
// the last one. IDs are an ever-increasing counter rather than array index, so React keys each
// row by its own identity: removing a middle row doesn't reshuffle every row after it into a
// different component instance, which matters since `renderItem` may return stateful content
// (a ColorPicker, for example) that needs to keep its state attached to the right row.
export const AutoIncrementingList = ({
  renderItem,
  initialCount = DEFAULT_INITIAL_COUNT,
  minCount = DEFAULT_MIN_COUNT,
  gap = DEFAULT_GAP,
  className,
}: AutoIncrementingListProps) => {
  const nextIdRef = useRef(initialCount);
  const [ids, setIds] = useState(() => Array.from({ length: initialCount }, (_, index) => `item-${index}`));

  const addItem = () => {
    const id = `item-${nextIdRef.current}`;
    nextIdRef.current += 1;
    setIds((prev) => [...prev, id]);
  };

  const removeItem = (id: string) => {
    setIds((prev) => (prev.length > minCount ? prev.filter((existingId) => existingId !== id) : prev));
  };

  return (
    <Box flex={{ direction: 'col', gap }} className={mergeClassNames('w-full', className)}>
      {ids.map((id, index) => {
        const isLast = index === ids.length - 1;
        const canRemove = ids.length > minCount;

        return (
          // align: 'end' (not 'center') so the buttons line up with the bottom edge of
          // whatever `renderItem` returns - for field-like content (a label sitting above its
          // actual control, e.g. ColorPicker) that's the control itself, not the midpoint of
          // the label+control stack; for label-less single-line content top and bottom
          // coincide anyway, so this is never worse than centering.
          <Box key={id} flex={{ direction: 'row', align: 'end', gap: 8 }} className="w-full">
            <Box className="min-w-0 flex-1">{renderItem(index, id)}</Box>

            {isLast && (
              <Button
                type="button"
                variant={{ kind: 'filled', color: 'primary' }}
                onClick={addItem}
                aria-label="Add item"
                className="h-10 shrink-0 inline-flex items-center justify-center"
              >
                <Icon as="span" name="Plus" size={16} weight="bold" />
              </Button>
            )}

            {canRemove && (
              <Button
                type="button"
                variant={{ kind: 'filled', color: 'red', intensity: 600 }}
                onClick={() => removeItem(id)}
                aria-label="Remove item"
                className="h-10 shrink-0 inline-flex items-center justify-center"
              >
                <Icon as="span" name="Minus" size={16} weight="bold" />
              </Button>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
