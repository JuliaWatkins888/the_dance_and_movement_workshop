import { Box, Text } from '@inithium/ui';

export const DocsPage = () => (
  <Box flex={{ direction: 'col', gap: 12 }} padding={{ base: 32 }}>
    <Text as="h1" className="text-3xl font-bold">
      Docs
    </Text>
    <Text as="p" className="text-base">
      Another primary-nav test page — useful for confirming the Navbar highlights/handles more
      than one link, and that the mobile drawer lists them all in order.
    </Text>
  </Box>
);

export default DocsPage;
