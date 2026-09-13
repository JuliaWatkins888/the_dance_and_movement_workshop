import type { CreatePageInput } from '../contracts/page.contract';

// Not linked from any generic nav location - its href needs the *viewer's own* Mongo id, which
// a static Page record can't embed, so it's linked manually from the Navbar's authenticated
// drawer (see @inithium/ui's Navbar.tsx) instead of a `useGetNavPagesQuery` location.
const profilePageSeed: CreatePageInput = {
  slug: 'profile',
  title: 'Profile',
  routePattern: '/profile/:id',
  isPluginPage: false,
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: [], label: 'Profile', order: 0 },
  layoutTemplate: 'full-width',
  isPublished: true,
};

export default profilePageSeed;
