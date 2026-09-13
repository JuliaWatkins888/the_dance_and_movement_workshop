import { Box, Text } from '@inithium/ui';

export const PrivacyPolicyPage = () => (
  <Box flex={{ direction: 'col', gap: 12 }} padding={{ base: 32 }}>
    <Text as="h1" className="text-3xl font-bold">
      Privacy Policy
    </Text>
    <Text as="p" className="text-base">
      A secondary-footer test page — useful for confirming the Footer's secondary section renders
      links alongside the copyright line.
    </Text>
  </Box>
);

export default PrivacyPolicyPage;
