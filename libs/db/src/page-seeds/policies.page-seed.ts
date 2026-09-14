import type { CreatePageInput } from '../contracts/page.contract';

const policiesPageSeed: CreatePageInput = {
  slug: 'policies',
  title: 'Studio Policies',
  routePattern: '/policies',
  isPluginPage: true,
  pluginOrigin: 'policy',
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: ['primary-nav'], label: 'Policies', order: 6 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default policiesPageSeed;
