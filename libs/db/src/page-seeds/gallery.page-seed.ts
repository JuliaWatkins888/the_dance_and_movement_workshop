import type { CreatePageInput } from '../contracts/page.contract';

const galleryPageSeed: CreatePageInput = {
  slug: 'gallery',
  title: 'Gallery',
  routePattern: '/gallery',
  isPluginPage: true,
  pluginOrigin: 'gallery',
  animation: { enter: 'animate__fadeIn', exit: 'animate__fadeOut', duration: 300, delay: 0 },
  backgroundColor: { color: 'surface', intensity: 100 },
  foregroundColor: { color: 'surface', intensity: 950 },
  access: { isPublic: true, isAnonymousOnly: false, requiredRoles: [] },
  navigation: { locations: ['primary-nav', 'primary-footer'], label: 'Gallery', order: 3 },
  layoutTemplate: 'default',
  isPublished: true,
};

export default galleryPageSeed;
