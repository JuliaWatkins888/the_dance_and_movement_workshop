import { useState } from 'react';
import { Box, Button, Text } from '@inithium/ui';
import type { ChildDto, ClassAttendeeDto } from '@inithium/api-client';
import { attendeeKeyOf } from '../classes/registrationChoices';
import { openStudentDialog } from './openStudentDialog';

export interface AddStudentActionProps {
  readonly courseKind: 'class' | 'workshop';
  readonly refreshAttendees: () => PromiseLike<{ readonly data?: ClassAttendeeDto[] | undefined; readonly isError: boolean }>;
  readonly onEligible: (attendeeKey: string) => void;
}

// Keep this mounted while the attendee list reloads: the outcome note lives here, and it is set
// after that reload finishes.
export const AddStudentAction = ({ courseKind, refreshAttendees, onEligible }: AddStudentActionProps) => {
  const [note, setNote] = useState<string | undefined>(undefined);

  // Awaits the refetch rather than reading the list from props, so eligibility is only ever
  // judged against a list that was loaded after the student was created.
  const handleSaved = async (student: ChildDto) => {
    const { data, isError } = await refreshAttendees();
    if (isError) {
      setNote(`Added ${student.firstName}, but we couldn’t refresh your dancers. Please reload the page.`);
    } else if (data?.some((attendee) => attendeeKeyOf(attendee) === student.id)) {
      onEligible(student.id);
    } else {
      setNote(`Added, but ${student.firstName} isn’t in the age range for this ${courseKind}.`);
    }
  };

  const handleClick = () => {
    setNote(undefined);
    openStudentDialog({ onSaved: handleSaved });
  };

  return (
    <Box flex={{ direction: 'col', align: 'start', gap: 6 }}>
      <Button variant={{ kind: 'outlined', color: 'primary' }} onClick={handleClick}>
        Add a student
      </Button>
      {note ? (
        <div role="status">
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
            {note}
          </Text>
        </div>
      ) : null}
    </Box>
  );
};
