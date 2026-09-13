import { Box, Switch, Text } from '@inithium/ui';
import { useIsDarkModeFeatureEnabled, useToggleDarkModeMutation } from '@inithium/api-client';
import type { ProfileTabDescriptor, ProfileTabProps } from './registry';

// Only ever mounted for the profile's own owner (visibility: 'owned' below), so `profile.darkMode`
// here is always the signed-in user's own preference, never a viewed stranger's.
const SettingsTab = ({ profile }: ProfileTabProps) => {
  const darkModeFeatureEnabled = useIsDarkModeFeatureEnabled();
  const [toggleDarkMode, { isLoading }] = useToggleDarkModeMutation();

  if (!darkModeFeatureEnabled) {
    return (
      <Text as="p" className="text-sm text-surface-500">
        Dark mode isn&apos;t available right now.
      </Text>
    );
  }

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }}>
        <Box flex={{ direction: 'col' }}>
          <Text as="span" className="font-medium">
            Dark Mode
          </Text>
          <Text as="span" className="text-sm text-surface-500">
            Switch the app to a dark color scheme.
          </Text>
        </Box>
        <Switch checked={profile.darkMode} disabled={isLoading} onCheckedChange={() => toggleDarkMode()} />
      </Box>
    </Box>
  );
};

const settingsTab: ProfileTabDescriptor = {
  id: 'settings',
  label: 'Settings',
  order: 20,
  visibility: 'owned',
  Component: SettingsTab,
};

export default settingsTab;
