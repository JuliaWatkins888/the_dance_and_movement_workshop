import { useState } from 'react';
import { AmpersandText, AutoIncrementingList, Box, ColorPicker, Text } from '@inithium/ui';
import { useAppName } from '@inithium/api-client';
import heroImage from '../assets/hero-image.png';

export const HomePage = () => {
  const [color, setColor] = useState('#006a8e');
  const appName = useAppName();

  return (
    <Box flex={{ direction: 'col', gap: 12 }} padding={{ base: 32 }} className="flex-1">
      <Box flex={{direction: 'row', justify: 'between'}} className="flex-1">
        <Box flex={{direction: 'col', justify:'center', gap: 16}} padding={{base: 32}} className='w-1/2'>
          {/* Shown here instead of the Navbar (which hides its title on this page specifically)
              so the brand name doesn't appear twice on the one page that already leads with it. */}
          <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-3xl font-bold">
            <AmpersandText text={appName} />
          </Text>
          <Text as="p" className="text-base">
            Cultivating growth <AmpersandText text="&" /> celebrating community through dance and movement. The Dance and Movement Workshop is a community-focused studio offering classes for all ages. We foster a love of dance while building strong technical foundations. During our season, we host inclusive workshops that welcome students from all studios, creating a shared space for growth, connection, and collaboration. Our Workshop classes are designed to make movement accessible, no matter your age or experience level. These classes are intended to allow all dance students to learn new styles of dance, workshop their weaknesses, and build confidence. Whether you're new to dance or a lifelong mover, this is a space to explore, create, and connect. Each week offers a fresh take on movement, led by passionate instructors who believe dance should be for every. body.
          </Text>
        </Box>
        <Box flex={{direction: 'col', justify:'center'}} padding={{base: 32}} className='w-1/2'>
          <img src={heroImage} alt="Dancers at The Dance and Movement Workshop" className="w-full h-auto rounded-md object-cover" />
        </Box>
      </Box>
    </Box>
  );
};

export default HomePage;
