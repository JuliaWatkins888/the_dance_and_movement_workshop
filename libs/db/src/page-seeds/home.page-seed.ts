import type { CreatePageInput } from '../contracts/page.contract';

const homePageSeed: CreatePageInput = {
  slug: 'home',
  title: 'Home',
  routePattern: '/',
  isPluginPage: false,
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: ['primary-nav', 'primary-footer'], label: 'Home', order: 0 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default homePageSeed;
