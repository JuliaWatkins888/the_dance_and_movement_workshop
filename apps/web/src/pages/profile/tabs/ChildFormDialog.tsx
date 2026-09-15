import { useState } from 'react';
import { Box, Button, Input, Select, SelectItem, Text } from '@inithium/ui';
import { useCreateChildMutation, useUpdateChildMutation } from '@inithium/api-client';
import type { ChildDto } from '@inithium/api-client';
import { CHILD_GENDERS, CHILD_GENDER_LABELS } from './childGenders';

interface FieldErrors {
  firstName?: string;
  age?: string;
}

export interface ChildFormDialogProps {
  readonly mode: 'create' | 'edit';
  readonly initialChild?: ChildDto;
  readonly onDone: () => void;
}

// Self-service create/edit for a parent's own child - shares its shape with UserFormDialog
// (plain useState fields + hand-rolled validate()) but never sends parentUserId: the API always
// scopes a non-manager's create/update to the caller's own account (see children.route.ts), so
// there's no parent picker here the way the CMS's ChildEditDialog needs one.
export const ChildFormDialog = ({ mode, initialChild, onDone }: ChildFormDialogProps) => {
  const [createChild, { isLoading: isCreating }] = useCreateChildMutation();
  const [updateChild, { isLoading: isUpdating }] = useUpdateChildMutation();
  const isSubmitting = isCreating || isUpdating;

  const [firstName, setFirstName] = useState(initialChild?.firstName ?? '');
  const [lastName, setLastName] = useState(initialChild?.lastName ?? '');
  const [age, setAge] = useState(String(initialChild?.age ?? ''));
  const [gender, setGender] = useState(initialChild?.gender ?? CHILD_GENDERS[0]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!firstName.trim()) {
      errors.firstName = "Your child's first name is required.";
    }
    const parsedAge = Number(age);
    if (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 17) {
      errors.age = 'Enter an age between 0 and 17.';
    }
    return errors;
  };

  const handleSubmit = async () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitError(undefined);

    const commonFields = {
      firstName,
      lastName: lastName || undefined,
      age: Number(age),
      gender,
    };

    try {
      if (mode === 'create') {
        await createChild(commonFields).unwrap();
      } else if (initialChild) {
        await updateChild({ id: initialChild.id, ...commonFields }).unwrap();
      }
      onDone();
    } catch {
      setSubmitError('Could not save this child account. Check the fields and try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input
          label="First Name"
          required
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          error={Boolean(fieldErrors.firstName)}
          helperText={fieldErrors.firstName}
          className="flex-1"
        />
        <Input label="Last Name" value={lastName} onChange={(event) => setLastName(event.target.value)} className="flex-1" />
      </Box>

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input
          label="Age"
          type="number"
          required
          value={age}
          onChange={(event) => setAge(event.target.value)}
          error={Boolean(fieldErrors.age)}
          helperText={fieldErrors.age}
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
        <Text as="p" className="text-sm text-red-600">
          {submitError}
        </Text>
      ) : null}

      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : mode === 'create' ? 'Add Child' : 'Save Changes'}
        </Button>
      </Box>
    </Box>
  );
};
