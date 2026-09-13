import type { CreatePageInput } from '../contracts/page.contract';

const staffPageSeed: CreatePageInput = {
  slug: 'staff',
  title: 'Our Staff',
  routePattern: '/staff',
  isPluginPage: true,
  pluginOrigin: 'staff',
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: ['primary-nav', 'primary-footer'], label: 'Our Staff', order: 5 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default staffPageSeed;
