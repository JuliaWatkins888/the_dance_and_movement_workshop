import { Box, Tabs, TabsContent, TabsList, TabsTrigger, Text } from '@inithium/ui';
import { CalendarEntriesTab } from './CalendarEntriesTab';
import { HolidaysTab } from './HolidaysTab';

export const CalendarAdminModule = () => (
  <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
    <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
      Calendar
    </Text>
    <Tabs defaultValue="entries">
      <TabsList>
        <TabsTrigger value="entries">Entries &amp; Closures</TabsTrigger>
        <TabsTrigger value="holidays">Holidays</TabsTrigger>
      </TabsList>
      <TabsContent value="entries" className="pt-4">
        <CalendarEntriesTab />
      </TabsContent>
      <TabsContent value="holidays" className="pt-4">
        <HolidaysTab />
      </TabsContent>
    </Tabs>
  </Box>
);
