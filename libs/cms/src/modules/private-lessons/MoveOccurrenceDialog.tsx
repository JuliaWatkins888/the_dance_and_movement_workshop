import { useState } from 'react';
import { Box, Button, Input, Text } from '@inithium/ui';
import { readApiError, useSetPrivateLessonExceptionMutation } from '@inithium/api-client';
import type { PrivateLessonOccurrenceDto } from '@inithium/api-client';
import { FormError } from '../ecommerce/shared';
import { formatLongDay, formatTimeRange } from './privateLessonFormat';

export interface MoveOccurrenceDialogProps {
  readonly occurrence: PrivateLessonOccurrenceDto;
  readonly onDone: () => void;
}

// Moves one lesson to another date/time. The rest of the schedule is unchanged.
export const MoveOccurrenceDialog = ({ occurrence, onDone }: MoveOccurrenceDialogProps) => {
  const [move, { isLoading }] = useSetPrivateLessonExceptionMutation();
  const [newDate, setNewDate] = useState(occurrence.date);
  const [newStartTime, setNewStartTime] = useState(occurrence.startTime);
  const [newEndTime, setNewEndTime] = useState(occurrence.endTime);
  const [error, setError] = useState<string | undefined>(undefined);

  const submit = async () => {
    setError(undefined);
    if (!newDate || !newStartTime || !newEndTime) return setError('Choose a date, start time and end time.');
    if (newEndTime <= newStartTime) return setError('End time must be after start time.');
    try {
      await move({ lessonId: occurrence.lessonId, kind: 'moved', date: occurrence.scheduledDate, newDate, newStartTime, newEndTime }).unwrap();
      onDone();
    } catch (moveError) {
      setError(readApiError(moveError, 'Could not move this lesson.').message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Text as="p" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
        {`Scheduled for ${formatLongDay(occurrence.scheduledDate)}. `}
        {occurrence.isMoved ? `Currently moved to ${formatLongDay(occurrence.date)}, ${formatTimeRange(occurrence.startTime, occurrence.endTime)}.` : ''}
      </Text>
      <Box className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input label="New date" type="date" required value={newDate} onChange={(event) => setNewDate(event.target.value)} />
        <Input label="Start time" type="time" required value={newStartTime} onChange={(event) => setNewStartTime(event.target.value)} />
        <Input label="End time" type="time" required value={newEndTime} onChange={(event) => setNewEndTime(event.target.value)} />
      </Box>
      <FormError message={error} />
      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onDone} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={submit} disabled={isLoading}>
          {isLoading ? 'Moving…' : 'Move lesson'}
        </Button>
      </Box>
    </Box>
  );
};
