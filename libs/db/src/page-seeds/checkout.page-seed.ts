import type { CreatePageInput } from '../contracts/page.contract';

// Reached only from the cart page. Public for the same reason as the cart page.
const checkoutPageSeed: CreatePageInput = {
  slug: 'checkout',
  title: 'Checkout',
  routePattern: '/checkout',
  isPluginPage: true,
  pluginOrigin: 'ecommerce',
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: [], label: 'Checkout', order: 0 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default checkoutPageSeed;
