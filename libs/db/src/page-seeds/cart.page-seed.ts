import type { CreatePageInput } from '../contracts/page.contract';

// Reached from the navbar cart button rather than a nav location. Public on purpose: a signed-out
// visitor gets a sign-in prompt from the page itself instead of a bare 401/Not Found.
const cartPageSeed: CreatePageInput = {
  slug: 'cart',
  title: 'Cart',
  routePattern: '/cart',
  isPluginPage: true,
  pluginOrigin: 'ecommerce',
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: [], label: 'Cart', order: 0 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default cartPageSeed;
