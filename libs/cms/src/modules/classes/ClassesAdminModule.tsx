import { Box, Tabs, TabsContent, TabsList, TabsTrigger, Text } from '@inithium/ui';
import { CatalogTab } from './CatalogTab';
import { SchoolYearsTab } from './SchoolYearsTab';

export const ClassesAdminModule = () => (
  <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
    <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
      Classes
    </Text>
    <Tabs defaultValue="catalog">
      <TabsList>
        <TabsTrigger value="catalog">Programs &amp; Courses</TabsTrigger>
        <TabsTrigger value="school-years">School Years</TabsTrigger>
      </TabsList>
      <TabsContent value="catalog" className="pt-4">
        <CatalogTab />
      </TabsContent>
      <TabsContent value="school-years" className="pt-4">
        <SchoolYearsTab />
      </TabsContent>
    </Tabs>
  </Box>
);
