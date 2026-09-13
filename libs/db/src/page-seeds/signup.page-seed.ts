import type { CreatePageInput } from '../contracts/page.contract';

// Same rationale as login.page-seed.ts - reached via a button, not a nav link.
const signupPageSeed: CreatePageInput = {
  slug: 'signup',
  title: 'Signup',
  routePattern: '/signup',
  isPluginPage: false,
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 950 },
  foregroundColor: { color: 'surface', intensity: 100 },
  access: { isPublic: true, isAnonymousOnly: true, requiredRoles: [] },
  navigation: { locations: [], label: 'Signup', order: 0 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default signupPageSeed;
