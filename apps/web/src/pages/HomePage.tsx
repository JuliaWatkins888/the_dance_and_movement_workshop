import { useState } from 'react';
import { AutoIncrementingList, Box, ColorPicker, Text } from '@inithium/ui';
import { useAppName } from '@inithium/api-client';

export const HomePage = () => {
  const [color, setColor] = useState('#006a8e');
  const appName = useAppName();

  return (
    <Box flex={{ direction: 'col', gap: 12 }} padding={{ base: 32 }} className="flex-1">
      <Box flex={{direction: 'row', justify: 'between'}} className="flex-1">
        <Box flex={{direction: 'col', justify:'center'}} padding={{base: 32}} className='w-1/2'>
          <Text as="p" className="text-base">
            Cultivating growth & celebrating community through dance and movement. The Dance and Movement Workshop is a community-focused studio offering classes for all ages. We foster a love of dance while building strong technical foundations. During our season, we host inclusive workshops that welcome students from all studios, creating a shared space for growth, connection, and collaboration. Our Workshop classes are designed to make movement accessible, no matter your age or experience level. These classes are intended to allow all dance students to learn new styles of dance, workshop their weaknesses, and build confidence. Whether you're new to dance or a lifelong mover, this is a space to explore, create, and connect. Each week offers a fresh take on movement, led by passionate instructors who believe dance should be for every. body.
          </Text>
        </Box>
        <Box flex={{direction: 'col', justify:'center'}} padding={{base: 32}} className='w-1/2'>
          
        </Box>
      </Box>
    </Box>
  );
};

export default HomePage;
