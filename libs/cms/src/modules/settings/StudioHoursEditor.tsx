import { Box, Input, Text } from '@inithium/ui';
import { studioHoursEntryErrors } from '@inithium/api-client';
import type { StudioHoursEntry } from '@inithium/api-client';

export interface StudioHoursEditorProps {
  readonly days: readonly StudioHoursEntry[];
  readonly onChange: (next: readonly StudioHoursEntry[]) => void;
}

const withLink = ({ day, text }: StudioHoursEntry, linkUrl: string): StudioHoursEntry =>
  linkUrl.trim() ? { day, text, linkUrl } : { day, text };

export const StudioHoursEditor = ({ days, onChange }: StudioHoursEditorProps) => {
  const replaceDay = (index: number, next: StudioHoursEntry) =>
    onChange(days.map((entry, i) => (i === index ? next : entry)));

  return (
    <Box flex={{ direction: 'col', gap: 12 }}>
      {days.map((entry, index) => {
        const errors = studioHoursEntryErrors(entry);
        return (
          <Box key={entry.day} className="grid grid-cols-1 gap-2 sm:grid-cols-[3rem_1fr_1fr]">
            <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm font-semibold sm:pt-8">
              {entry.day}
            </Text>
            <Input
              label="Hours"
              value={entry.text}
              onChange={(event) => replaceDay(index, { ...entry, text: event.target.value })}
              error={Boolean(errors.text)}
              helperText={errors.text}
            />
            <Input
              label="Link (optional)"
              value={entry.linkUrl ?? ''}
              onChange={(event) => replaceDay(index, withLink(entry, event.target.value))}
              error={Boolean(errors.linkUrl)}
              helperText={errors.linkUrl}
            />
          </Box>
        );
      })}
    </Box>
  );
};
