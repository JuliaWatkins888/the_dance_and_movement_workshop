import type { CreatePageInput } from '../contracts/page.contract';

const productsPageSeed: CreatePageInput = {
  slug: 'merch',
  title: 'Merch',
  routePattern: '/merch',
  isPluginPage: true,
  pluginOrigin: 'ecommerce',
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: ['primary-nav', 'primary-footer'], label: 'Merch', order: 7 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default productsPageSeed;
