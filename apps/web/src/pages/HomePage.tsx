import { useState } from 'react';
import { AmpersandText, AutoIncrementingList, Box, ColorPicker, Text } from '@inithium/ui';
import { useAppName, usePublicImageSetting } from '@inithium/api-client';
import defaultHeroImage from '../assets/hero-image.png';

export const HomePage = () => {
  const [color, setColor] = useState('#006a8e');
  const appName = useAppName();
  // Bundled fallback until an admin uploads one to R2 via CMS > Settings (home.heroImage).
  const heroImage = usePublicImageSetting('home.heroImage', defaultHeroImage);

  return (
    <Box flex={{ direction: 'col', gap: 12 }} className="flex-1 p-4 md:p-8">
      <Box flex={{direction: 'col', justify: 'between'}} className="flex-1 lg:flex-row">
        <Box flex={{direction: 'col', justify:'center', gap: 16}} className='w-full p-4 md:p-8 lg:w-1/2'>
          {/* Shown here instead of the Navbar (which hides its title on this page specifically)
              so the brand name doesn't appear twice on the one page that already leads with it. */}
          <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-3xl font-bold">
            <AmpersandText text={appName} />
          </Text>
          <Text as="p" className="text-base">
            Cultivating growth <AmpersandText text="&" /> celebrating community through dance and movement. The Dance and Movement Workshop is a community-focused studio offering classes for all ages. We foster a love of dance while building strong technical foundations. During our season, we host inclusive workshops that welcome students from all studios, creating a shared space for growth, connection, and collaboration. Our Workshop classes are designed to make movement accessible, no matter your age or experience level. These classes are intended to allow all dance students to learn new styles of dance, workshop their weaknesses, and build confidence. Whether you're new to dance or a lifelong mover, this is a space to explore, create, and connect. Each week offers a fresh take on movement, led by passionate instructors who believe dance should be for every. body.
          </Text>
        </Box>
        <Box flex={{direction: 'col', justify:'center'}} className='w-full p-4 md:p-8 lg:w-1/2'>
          <img src={heroImage} alt="Dancers at The Dance and Movement Workshop" className="w-full h-auto rounded-md object-cover" />
        </Box>
      </Box>
    </Box>
  );
};

export default HomePage;
