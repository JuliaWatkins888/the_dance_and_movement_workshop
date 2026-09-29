import { Box, Button, Icon, Text, useNavigateWithTransition } from '@inithium/ui';

interface SignInPromptProps {
  readonly message: string;
  // Where the login page sends the shopper back to once signed in.
  readonly redirectTo: string;
}

export const loginPathFor = (redirectTo: string): string => `/login?redirect=${encodeURIComponent(redirectTo)}`;

export const SignInPrompt = ({ message, redirectTo }: SignInPromptProps) => {
  const navigate = useNavigateWithTransition();
  return (
    <Box flex={{ direction: 'col', align: 'center', gap: 16 }} padding={{ top: 48, bottom: 48 }}>
      <Icon name="LockSimple" size={40} textColor={{ color: 'surface', intensity: 500 }} />
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-center">
        {message}
      </Text>
      <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => navigate(loginPathFor(redirectTo))}>
        Log in
      </Button>
    </Box>
  );
};
