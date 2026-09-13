import { useState } from 'react';
import { Box, Button, Input, Text } from '@inithium/ui';
import { useAppName, useLoginMutation } from '@inithium/api-client';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  email?: string;
  password?: string;
}

export interface CmsLoginPageProps {
  readonly onLoginSuccess: (token: string) => void;
}

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

// Own branded login form, deliberately not a reuse of the public site's LoginPage - the CMS
// presents itself as a distinct admin area. Calls useLoginMutation directly (a lib-safe RTK
// Query hook) and hands the resulting token back up via onLoginSuccess instead of touching
// authStore itself, keeping libs/cms free of any app-level import.
export const CmsLoginPage = ({ onLoginSuccess }: CmsLoginPageProps) => {
  const appName = useAppName();
  const [login, { isLoading }] = useLoginMutation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const handleSubmit = async () => {
    const validationErrors = validate(email, password);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setFieldErrors({});
    setSubmitError(undefined);
    try {
      const result = await login({ email, password }).unwrap();
      onLoginSuccess(result.accessToken);
    } catch {
      setSubmitError('Invalid email or password.');
    }
  };

  return (
    <Box
      bgColor={{ color: 'surface', intensity: 950 }}
      className="min-h-screen w-full"
      flex={{ direction: 'col', justify: 'center', align: 'center', gap: 16 }}
      padding={{ base: 32 }}
    >
      <Text as="h1" className="text-2xl font-bold text-surface-100">
        {appName} CMS
      </Text>

      <Box
        flex={{ direction: 'col', gap: 24, align: 'stretch' }}
        bgColor={{ color: 'surface', intensity: 100 }}
        padding={{ base: 32 }}
        className="w-9/10 md:w-1/2 lg:w-1/3 rounded"
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
        <Input
          label="Password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={Boolean(fieldErrors.password || submitError)}
          helperText={fieldErrors.password ?? submitError}
        />
        <Button onClick={handleSubmit} variant={{ kind: 'filled', color: 'primary' }} disabled={isLoading}>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </Button>
      </Box>
    </Box>
  );
};
