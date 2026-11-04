import { useState } from 'react';
import { Box, Button, Input, Select, SelectItem, Text } from '@inithium/ui';
import { toBirthDateInputValue, useCreateChildMutation, useUpdateChildMutation, validateChildBirthDate } from '@inithium/api-client';
import type { ChildDto } from '@inithium/api-client';
import { CHILD_GENDERS, CHILD_GENDER_LABELS } from './childGenders';

interface FieldErrors {
  firstName?: string;
  birthDate?: string;
}

export interface ChildFormDialogProps {
  // Present when editing; creates a new student otherwise.
  readonly initialChild?: ChildDto | undefined;
  readonly onSaved: (student: ChildDto) => void;
  readonly onCancel: () => void;
}

// Self-service create/edit for a parent's own child - shares its shape with UserFormDialog
// (plain useState fields + hand-rolled validate()) but never sends parentUserId: the API always
// scopes a non-manager's create/update to the caller's own account (see children.route.ts), so
// there's no parent picker here the way the CMS's ChildEditDialog needs one.
export const ChildFormDialog = ({ initialChild, onSaved, onCancel }: ChildFormDialogProps) => {
  const [createChild, { isLoading: isCreating }] = useCreateChildMutation();
  const [updateChild, { isLoading: isUpdating }] = useUpdateChildMutation();
  const isSubmitting = isCreating || isUpdating;

  const [firstName, setFirstName] = useState(initialChild?.firstName ?? '');
  const [lastName, setLastName] = useState(initialChild?.lastName ?? '');
  const [birthDate, setBirthDate] = useState(toBirthDateInputValue(initialChild?.birthDate));
  const [gender, setGender] = useState(initialChild?.gender ?? CHILD_GENDERS[0]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!firstName.trim()) {
      errors.firstName = "The student's first name is required.";
    }
    const birthDateError = validateChildBirthDate(birthDate);
    if (birthDateError) {
      errors.birthDate = birthDateError;
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
      birthDate,
      gender,
    };

    try {
      const saved = initialChild
        ? await updateChild({ id: initialChild.id, ...commonFields }).unwrap()
        : await createChild(commonFields).unwrap();
      onSaved(saved);
    } catch {
      setSubmitError('Could not save this student. Check the fields and try again.');
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
          label="Date of Birth"
          type="date"
          required
          max={new Date().toISOString().slice(0, 10)}
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
          error={Boolean(fieldErrors.birthDate)}
          helperText={fieldErrors.birthDate ?? 'Used to show which classes this student is eligible for.'}
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
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : initialChild ? 'Save Changes' : 'Add Student'}
        </Button>
      </Box>
    </Box>
  );
};
