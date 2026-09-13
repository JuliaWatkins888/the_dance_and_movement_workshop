import { Box, Text } from '@inithium/ui';
import type { ProfileSectionDescriptor, ProfileSectionProps } from './registry';

// Core's own left-column content, added through the exact same registry every plugin section
// uses - nothing here is special-cased by ProfilePage.
const AccountInfoSection = ({ profile, isOwnProfile }: ProfileSectionProps) => (
  <Box flex={{ direction: 'col', gap: 4 }}>
    <Text as="h2" className="text-xl font-semibold">
      {[profile.firstName, profile.lastName].filter(Boolean).join(' ')}
    </Text>
    {isOwnProfile && profile.email ? <Text className="text-sm text-surface-600">{profile.email}</Text> : null}
    <Text className="text-sm text-surface-600">Joined {new Date(profile.createdAt).toLocaleDateString()}</Text>
  </Box>
);

const accountInfoSection: ProfileSectionDescriptor = {
  id: 'account-info',
  order: 0,
  Component: AccountInfoSection,
};

export default accountInfoSection;
