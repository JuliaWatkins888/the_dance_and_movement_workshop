import type { CreatePageInput } from '../contracts/page.contract';

// Not linked from any nav location - reached via the Navbar's own dedicated Login button
// (app.tsx's onLogin={() => navigate('/login')}), not a Page-based nav link.
const loginPageSeed: CreatePageInput = {
  slug: 'login',
  title: 'Login',
  routePattern: '/login',
  isPluginPage: false,
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 950 },
  foregroundColor: { color: 'surface', intensity: 100 },
  access: { isPublic: true, isAnonymousOnly: true, requiredRoles: [] },
  navigation: { locations: [], label: 'Login', order: 0 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default loginPageSeed;
