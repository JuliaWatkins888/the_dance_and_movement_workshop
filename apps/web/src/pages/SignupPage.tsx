import { useState } from 'react';
import { alert, Box, Button, Input, PasswordInput, Text, useNavigateWithTransition } from '@inithium/ui';
import { useRegisterMutation } from '@inithium/api-client';
import { authStore } from '../app/authStore';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  firstName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const showSubmissionErrorAlert = () => {
  alert.danger('There were problems submitting your form.', {
    position: 'bottom-right',
    animation: { entrance: 'animate__fadeInUp', exit: 'animate__fadeOutDown' },
  });
};

const validate = (firstName: string, email: string, password: string, confirmPassword: string): FieldErrors => {
  const errors: FieldErrors = {};
  if (!firstName.trim()) {
    errors.firstName = 'First name is required.';
  }
  if (!EMAIL_REGEX.test(email)) {
    errors.email = 'Please enter a valid email.';
  }
  if (!password) {
    errors.password = 'Password is required.';
  }
  if (password && confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  return errors;
};

export const SignupPage = () => {
  const navigate = useNavigateWithTransition();
  const [register, { isLoading }] = useRegisterMutation();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handleSubmit = async () => {
    const validationErrors = validate(firstName, email, password, confirmPassword);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      showSubmissionErrorAlert();
      return;
    }

    setFieldErrors({});
    try {
      const result = await register({ email, password, firstName, lastName: lastName || undefined }).unwrap();
      authStore.setToken(result.accessToken);
      navigate('/');
    } catch {
      setFieldErrors({ email: 'Could not create an account with those details.' });
      showSubmissionErrorAlert();
    }
  };

  return (
    <Box
      flex={{ direction: 'col', gap: 16, justify: 'center', align: 'center' }}
      padding={{ base: 32 }}
      className="w-full flex-1"
    >
      <Text as="h1" className="text-3xl font-bold">
        Sign up
      </Text>

      <Box
        flex={{ direction: 'col', gap: 36, align: 'stretch' }}
        bgColor={{ color: 'slate', intensity: 100 }}
        padding={{ base: 32 }}
        className="min-h-[25vh] w-[95%] md:w-2/3 lg:w-1/3 rounded"
      >
        <Input
          label="First name"
          required
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          error={Boolean(fieldErrors.firstName)}
          helperText={fieldErrors.firstName}
        />
        <Input label="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={Boolean(fieldErrors.email)}
          helperText={fieldErrors.email}
        />
        <PasswordInput
          label="Password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={Boolean(fieldErrors.password)}
          helperText={fieldErrors.password}
        />
        <PasswordInput
          label="Confirm password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={Boolean(fieldErrors.confirmPassword)}
          helperText={fieldErrors.confirmPassword}
        />
        <Button onClick={handleSubmit} variant={{ kind: 'filled', color: 'primary' }} disabled={isLoading}>
          {isLoading ? 'Creating account…' : 'Create account'}
        </Button>
      </Box>

      <Box flex={{ direction: 'row', align: 'center', justify: 'center', gap: 4 }}>
        <Text as="span">Already have an account?</Text>
        <Button variant={{ kind: 'link', color: 'accent' }} onClick={() => navigate('/login')}>
          Log in
        </Button>
      </Box>
    </Box>
  );
};

export default SignupPage;
