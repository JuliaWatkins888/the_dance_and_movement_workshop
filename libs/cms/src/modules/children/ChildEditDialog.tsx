import { useState } from 'react';
import { Box, Button, Input, Select, SelectItem, Text } from '@inithium/ui';
import { useCreateChildMutation, useUpdateChildMutation } from '@inithium/api-client';
import type { ChildDto, ChildParentCandidate } from '@inithium/api-client';
import { LinkedParentField } from './ParentUserPicker';
import { CHILD_GENDERS, CHILD_GENDER_LABELS } from './childGenderLabels';

export interface ChildEditDialogProps {
  readonly mode: 'create' | 'edit';
  readonly initialChild?: ChildDto;
  readonly onDone: () => void;
}

// Shared by both create and edit via `mode`, mirroring StaffEditDialog's own shape - a required
// parent-account link at the top (LinkedParentField, same "pick before saving on create" guard as
// staff's LinkedUserField), then plain useState fields for the child's own data.
export const ChildEditDialog = ({ mode, initialChild, onDone }: ChildEditDialogProps) => {
  const [createChild, { isLoading: isCreating }] = useCreateChildMutation();
  const [updateChild, { isLoading: isUpdating }] = useUpdateChildMutation();
  const isLoading = isCreating || isUpdating;
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const [selectedParent, setSelectedParent] = useState<ChildParentCandidate | null>(null);

  const [firstName, setFirstName] = useState(initialChild?.firstName ?? '');
  const [lastName, setLastName] = useState(initialChild?.lastName ?? '');
  const [age, setAge] = useState(String(initialChild?.age ?? ''));
  const [gender, setGender] = useState(initialChild?.gender ?? CHILD_GENDERS[0]);

  const handleSubmit = async () => {
    setSubmitError(undefined);

    if (mode === 'create' && !selectedParent) {
      setSubmitError('Choose a parent account to link before saving.');
      return;
    }

    const parsedAge = Number(age);
    if (!firstName.trim() || !Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 17) {
      setSubmitError('Enter a first name and an age between 0 and 17.');
      return;
    }

    const commonFields = {
      firstName,
      lastName: lastName || undefined,
      age: parsedAge,
      gender,
    };

    try {
      if (mode === 'create' && selectedParent) {
        await createChild({ parentUserId: selectedParent.id, ...commonFields }).unwrap();
      } else if (initialChild) {
        await updateChild({ id: initialChild.id, parentUserId: selectedParent?.id, ...commonFields }).unwrap();
      }
      onDone();
    } catch {
      setSubmitError('Could not save this child account. Check the fields and try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <LinkedParentField
        initialLabel={
          initialChild ? `${initialChild.parentFirstName} ${initialChild.parentLastName ?? ''}`.trim() : undefined
        }
        initialEmail={initialChild?.parentEmail}
        onSelect={setSelectedParent}
      />

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input label="First Name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} className="flex-1" />
        <Input label="Last Name" value={lastName} onChange={(event) => setLastName(event.target.value)} className="flex-1" />
      </Box>

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input
          label="Age"
          type="number"
          required
          value={age}
          onChange={(event) => setAge(event.target.value)}
          className="flex-1"
        />
        <Select label="Gender" value={gender} onValueChange={(value) => setGender(value as typeof gender)} className="flex-1">
          {CHILD_GENDERS.map((option) => (
            <SelectItem key={option} value={option}>
              {CHILD_GENDER_LABELS[option]}
            </SelectItem>
          ))}
        </Select>
      </Box>

      {submitError ? (
        <Text as="p" textColor={{ color: 'red', intensity: 600 }} className="text-sm">
          {submitError}
        </Text>
      ) : null}

      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onDone} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};
