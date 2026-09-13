import { useState } from 'react';
import { alert, Box, Button, Input, PasswordInput, Text, useNavigateWithTransition } from '@inithium/ui';
import { useLoginMutation } from '@inithium/api-client';
import { authStore } from '../app/authStore';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  email?: string;
  password?: string;
}

const showSubmissionErrorAlert = () => {
  alert.danger('There were problems submitting your form.', {
    position: 'bottom-right',
    animation: { entrance: 'animate__fadeInUp', exit: 'animate__fadeOutDown' },
  });
};

const validate = (email: string, password: string): FieldErrors => {
  const errors: FieldErrors = {};
  if (!EMAIL_REGEX.test(email)) {
    errors.email = 'Please enter a valid email.';
  }
  if (!password) {
    errors.password = 'Password is required.';
  }
  return errors;
};

// Reachable via the Navbar's Login button. Register a user first via the "Auth" folder in the
// Postman collection, then sign in here with the same credentials.
export const LoginPage = () => {
  const navigate = useNavigateWithTransition();
  const [login, { isLoading }] = useLoginMutation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handleSubmit = async () => {
    const validationErrors = validate(email, password);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      showSubmissionErrorAlert();
      return;
    }

    setFieldErrors({});
    try {
      const result = await login({ email, password }).unwrap();
      authStore.setToken(result.accessToken);
      navigate('/');
    } catch {
      setFieldErrors({ password: 'Invalid email or password.' });
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
        Login
      </Text>

      <Box
        flex={{ direction: 'col', gap: 36, align: 'stretch' }}
        bgColor={{ color: 'slate', intensity: 100 }}
        padding={{ base: 32 }}
        className="min-h-[25vh] w-[95%] md:w-2/3 lg:w-1/3 rounded"
      >
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
        <Button onClick={handleSubmit} variant={{ kind: 'filled', color: 'primary' }} disabled={isLoading}>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </Button>
      </Box>

      <Box flex={{ direction: 'row', align: 'center', justify: 'center', gap: 4 }}>
        <Text as="span">Need an account?</Text>
        <Button variant={{ kind: 'link', color: 'accent' }} onClick={() => navigate('/signup')}>
          Sign Up
        </Button>
      </Box>
    </Box>
  );
};

export default LoginPage;
