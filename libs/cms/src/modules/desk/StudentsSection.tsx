import { useState } from 'react';
import { Box, Button, Input, Select, SelectItem, Text } from '@inithium/ui';
import { formatChildAge, readApiError, useAddDeskStudentMutation, validateChildBirthDate } from '@inithium/api-client';
import type { DeskAccountDetailDto } from '@inithium/api-client';
import { CHILD_GENDERS, CHILD_GENDER_LABELS } from '../children/childGenderLabels';
import { FormError } from '../ecommerce/shared';
import { personName } from './deskShared';

const AddStudentForm = ({ accountId, onDone }: { readonly accountId: string; readonly onDone: () => void }) => {
  const [addStudent, { isLoading }] = useAddDeskStudentMutation();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<string>(CHILD_GENDERS[0]);
  const [error, setError] = useState<string | undefined>(undefined);

  const submit = async () => {
    setError(undefined);
    if (!firstName.trim()) return setError('Enter the student’s first name.');
    const birthDateError = validateChildBirthDate(birthDate);
    if (birthDateError) return setError(birthDateError);
    try {
      await addStudent({ accountId, firstName: firstName.trim(), ...(lastName.trim() ? { lastName: lastName.trim() } : {}), birthDate, gender }).unwrap();
      onDone();
    } catch (addError) {
      setError(readApiError(addError, 'Could not add the student.').message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 12 }} borderColor={{ color: 'surface', intensity: 300 }} padding={{ base: 16 }} className="rounded-md border">
      <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="First name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        <Input label="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
        <Input label="Date of birth" type="date" required value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
        <Select label="Pronouns" value={gender} onValueChange={setGender}>
          {CHILD_GENDERS.map((value) => (
            <SelectItem key={value} value={value}>
              {CHILD_GENDER_LABELS[value]}
            </SelectItem>
          ))}
        </Select>
      </Box>
      <FormError message={error} />
      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onDone} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={submit} disabled={isLoading}>
          {isLoading ? 'Adding…' : 'Add student'}
        </Button>
      </Box>
    </Box>
  );
};

export const StudentsSection = ({ account }: { readonly account: DeskAccountDetailDto }) => {
  const [isAdding, setIsAdding] = useState(false);

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      {account.students.length === 0 ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          No students on this account yet. The account holder can only take adult classes, so add each dancer here.
        </Text>
      ) : (
        account.students.map((student) => (
          <Box key={student.id} flex={{ direction: 'row', justify: 'between', gap: 8 }} className="text-sm">
            <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
              {personName(student)}
            </Text>
            <Text as="span" textColor={{ color: 'surface', intensity: 600 }}>
              {formatChildAge(student.birthDate)}
            </Text>
          </Box>
        ))
      )}
      {isAdding ? (
        <AddStudentForm accountId={account.id} onDone={() => setIsAdding(false)} />
      ) : (
        <Box>
          <Button variant={{ kind: 'outlined', color: 'primary' }} textColor={{ color: 'surface', intensity: 900 }} onClick={() => setIsAdding(true)}>
            Add a student
          </Button>
        </Box>
      )}
    </Box>
  );
};
