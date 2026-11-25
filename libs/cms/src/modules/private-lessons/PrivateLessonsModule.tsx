import { Box, Tabs, TabsContent, TabsList, TabsTrigger, Text } from '@inithium/ui';
import { LessonsTab } from './LessonsTab';
import { ScheduleTab } from './ScheduleTab';

export const PrivateLessonsModule = () => (
  <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
    <Box flex={{ direction: 'col', gap: 4 }}>
      <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
        Private Lessons
      </Text>
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
        Staff-scheduled lessons. Each lesson taught is charged to the family’s account. Lessons never show on the public calendar.
      </Text>
    </Box>
    <Tabs defaultValue="schedule">
      <TabsList>
        <TabsTrigger value="schedule">Schedule</TabsTrigger>
        <TabsTrigger value="lessons">Lessons</TabsTrigger>
      </TabsList>
      <TabsContent value="schedule" className="pt-4">
        <ScheduleTab />
      </TabsContent>
      <TabsContent value="lessons" className="pt-4">
        <LessonsTab />
      </TabsContent>
    </Tabs>
  </Box>
);
