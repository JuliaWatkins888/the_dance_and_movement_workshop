import { useState } from 'react';
import { Box, Button, Input, Text } from '@inithium/ui';
import { useUpdateMyProfileMutation } from '@inithium/api-client';
import { useOpenChangePasswordDialog } from '../openChangePasswordDialog';
import type { ProfileTabDescriptor, ProfileTabProps } from './registry';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  firstName?: string;
  email?: string;
}

// Core's own tab, added through the exact same registry every plugin tab uses. visibility:
// 'owned' on the descriptor below already keeps this out of the tab list entirely for anyone but
// the profile's own owner, so - unlike the old always-mounted right-column section this replaced
// - there's no need for this component to guard against rendering for a non-owner itself.
const AccountSettingsTab = ({ profile }: ProfileTabProps) => {
  const [updateMyProfile, { isLoading }] = useUpdateMyProfileMutation();
  const openChangePasswordDialog = useOpenChangePasswordDialog();

  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName ?? '');
  const [email, setEmail] = useState(profile.email ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const [savedAt, setSavedAt] = useState<number | undefined>(undefined);

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!firstName.trim()) errors.firstName = 'First name is required.';
    if (!EMAIL_REGEX.test(email)) errors.email = 'Please enter a valid email.';
    return errors;
  };

  const handleSave = async () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitError(undefined);

    try {
      await updateMyProfile({ firstName, lastName: lastName || undefined, email }).unwrap();
      setSavedAt(Date.now());
    } catch {
      setSubmitError('Could not save your changes. Check the fields and try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Input
        label="First Name"
        required
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
        error={Boolean(fieldErrors.firstName)}
        helperText={fieldErrors.firstName}
      />
      <Input label="Last Name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
      <Input
        label="Email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={Boolean(fieldErrors.email)}
        helperText={fieldErrors.email}
      />
      {submitError ? (
        <Text as="p" className="text-sm text-red-600">
          {submitError}
        </Text>
      ) : null}
      {savedAt ? (
        <Text as="p" className="text-sm text-green-600">
          Saved.
        </Text>
      ) : null}
      <Box flex={{ direction: 'row', gap: 8 }}>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSave} disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Save Changes'}
        </Button>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={openChangePasswordDialog}>
          Change Password
        </Button>
      </Box>
    </Box>
  );
};

const accountSettingsTab: ProfileTabDescriptor = {
  id: 'account-settings',
  label: 'Account Settings',
  order: 0,
  visibility: 'owned',
  Component: AccountSettingsTab,
};

export default accountSettingsTab;
