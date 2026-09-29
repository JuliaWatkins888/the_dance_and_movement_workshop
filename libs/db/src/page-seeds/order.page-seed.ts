import type { CreatePageInput } from '../contracts/page.contract';

// The post-checkout confirmation, and a linkable view of any one of the signed-in user's orders.
const orderPageSeed: CreatePageInput = {
  slug: 'order',
  title: 'Order',
  routePattern: '/orders/:id',
  isPluginPage: true,
  pluginOrigin: 'ecommerce',
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: [], label: 'Order', order: 0 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default orderPageSeed;
