import { useState } from 'react';
import { Box, Button, Input, Select, SelectItem, Text } from '@inithium/ui';
import { useCreateUserMutation, useUpdateUserMutation } from '@inithium/api-client';
import type { AdminUser } from '@inithium/api-client';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Hardcoded local mirror of @inithium/db's CORE_ROLES rather than importing it - every existing
// frontend import from @inithium/db is `import type` only, since @inithium/db's barrel also
// re-exports the Mongo provider and its mongoose-dependent code; importing this as a runtime
// *value* would pull that into the client bundle. Small, stable literal array, kept in sync by
// hand (same precedent as PageEditDialog's NAV_LOCATIONS/PAGE_LAYOUT_TEMPLATES mirrors).
const CORE_ROLES = ['user', 'contributor', 'editor', 'admin'] as const;
const ROLE_LABELS: Record<(typeof CORE_ROLES)[number], string> = {
  user: 'User',
  contributor: 'Contributor',
  editor: 'Editor',
  admin: 'Admin',
};

interface FieldErrors {
  email?: string;
  password?: string;
  firstName?: string;
}

export interface UserFormDialogProps {
  readonly mode: 'create' | 'edit';
  readonly initialUser?: AdminUser;
  readonly onDone: () => void;
}

// Shared by both create and edit via `mode` - the field set and validation are Users-specific
// (a Pages form would look nothing like this), so this stays local to the CMS plugin rather than
// becoming a generic cross-entity form-builder abstraction with only one real consumer to model.
export const UserFormDialog = ({ mode, initialUser, onDone }: UserFormDialogProps) => {
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const isSubmitting = isCreating || isUpdating;

  const [email, setEmail] = useState(initialUser?.email ?? '');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState(initialUser?.firstName ?? '');
  const [lastName, setLastName] = useState(initialUser?.lastName ?? '');
  const [role, setRole] = useState(initialUser?.role ?? 'user');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!EMAIL_REGEX.test(email)) {
      errors.email = 'Please enter a valid email.';
    }
    if (!firstName.trim()) {
      errors.firstName = 'First name is required.';
    }
    // Required on create; on edit a blank password means "leave the current password
    // unchanged," so it's only validated when the admin actually typed something.
    if ((mode === 'create' || password) && password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
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

    try {
      if (mode === 'create') {
        await createUser({ email, password, firstName, lastName: lastName || undefined, role }).unwrap();
      } else if (initialUser) {
        await updateUser({
          id: initialUser.id,
          email,
          firstName,
          lastName: lastName || undefined,
          role,
          ...(password ? { password } : {}),
        }).unwrap();
      }
      onDone();
    } catch {
      setSubmitError('Could not save this user. Check the fields and try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Input
        label="Email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={Boolean(fieldErrors.email)}
        helperText={fieldErrors.email}
      />
      <Input
        label={mode === 'create' ? 'Password' : 'New Password'}
        type="password"
        required={mode === 'create'}
        placeholder={mode === 'edit' ? 'Leave blank to keep current password' : undefined}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={Boolean(fieldErrors.password)}
        helperText={fieldErrors.password}
      />
      <Input
        label="First Name"
        required
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
        error={Boolean(fieldErrors.firstName)}
        helperText={fieldErrors.firstName}
      />
      <Input label="Last Name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
      <Select
        label="Role"
        value={role}
        onValueChange={setRole}
        disabled={initialUser?.isOwner}
        helperText={initialUser?.isOwner ? "The owner's role can't be changed here." : undefined}
      >
        {CORE_ROLES.map((coreRole) => (
          <SelectItem key={coreRole} value={coreRole}>
            {ROLE_LABELS[coreRole]}
          </SelectItem>
        ))}
      </Select>
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
          {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create User' : 'Save Changes'}
        </Button>
      </Box>
    </Box>
  );
};
